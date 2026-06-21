/**
 * 群成员搜索工具
 * 根据群昵称/QQ 昵称搜索 qqid，或根据 qqid 查询群成员昵称
 */

import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import type { Session } from "koishi";
import type { LogFn, MemberInfo } from "../../../types";
import { ensureOneBotSession } from "../onebot-api";
import { getSession } from "../session";
import { DEFAULT_SEARCH_GROUP_MEMBER_TOOL_DESCRIPTION } from "../defaults";

export type SearchGroupMemberMode = "auto" | "byName" | "byQQ";

export interface SearchGroupMemberToolDeps {
  toolName: string;
  description: string;
  log?: LogFn;
}

export interface SearchGroupMemberParams {
  session: Session | null;
  query: string;
  mode?: SearchGroupMemberMode;
  groupId?: string;
  log?: LogFn;
}

const MAX_RESULTS = 10;

function pickFirst(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function resolveGroupId(session: Session, groupId?: string): string {
  return (
    groupId?.trim() ||
    session.guildId?.trim() ||
    ((session as unknown as { event?: { guild?: { id?: string } } }).event
      ?.guild?.id || "")
  );
}

function normalizeId(value: string): string | number {
  return /^\d+$/.test(value) ? Number(value) : value;
}

function getUserId(member: MemberInfo): string {
  return pickFirst(
    member.user_id,
    member.userId,
    member.id,
    member.qq,
    member.uid,
  );
}

function getGroupCard(member: MemberInfo): string {
  return pickFirst(member.card, member.remark, member.displayName);
}

function getNickname(member: MemberInfo): string {
  return pickFirst(
    member.nick,
    member.nickname,
    member.name,
    member.user?.nickname,
    member.user?.name,
  );
}

function matchByName(member: MemberInfo, query: string): boolean {
  const keyword = query.toLowerCase();
  return [getGroupCard(member), getNickname(member)]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(keyword));
}

async function fetchGroupMembers(
  session: Session,
  groupId: string,
): Promise<MemberInfo[]> {
  const internal = (session.bot as unknown as {
    internal?: Record<string, unknown>;
  }).internal;
  if (!internal) return [];

  if (typeof internal.getGroupMemberList === "function") {
    const result = await (
      internal.getGroupMemberList as (
        groupId: string | number,
      ) => Promise<unknown>
    )(normalizeId(groupId));
    return Array.isArray(result) ? (result as MemberInfo[]) : [];
  }

  if (typeof internal._request === "function") {
    const result = await (
      internal._request as (
        action: string,
        params: Record<string, unknown>,
      ) => Promise<unknown>
    )("get_group_member_list", {
      group_id: normalizeId(groupId),
    });
    if (Array.isArray(result)) return result as MemberInfo[];
    const data = (result as { data?: unknown })?.data;
    return Array.isArray(data) ? (data as MemberInfo[]) : [];
  }

  throw new Error("当前 OneBot 适配器不支持 get_group_member_list 接口。");
}

function formatMember(index: number, member: MemberInfo): string {
  const userId = getUserId(member) || "未知";
  const groupCard = getGroupCard(member) || "无";
  const nickname = getNickname(member) || "无";
  return `${index}. qqid：${userId}，群昵称：${groupCard}，QQ昵称：${nickname}`;
}

export async function searchGroupMember(
  params: SearchGroupMemberParams,
): Promise<string> {
  try {
    const { session, query, groupId, log } = params;
    const mode = params.mode || "auto";
    if (!["auto", "byName", "byQQ"].includes(mode)) {
      return "mode must be auto, byName, or byQQ.";
    }

    const queryText = query.trim();
    if (!queryText) return "query is required.";

    const {
      error,
      session: validatedSession,
    } = ensureOneBotSession(session);
    if (error) return error;

    const resolvedGroupId = resolveGroupId(validatedSession!, groupId);
    if (!resolvedGroupId) {
      return "Missing groupId. Provide groupId explicitly or run inside a group session.";
    }

    const members = await fetchGroupMembers(validatedSession!, resolvedGroupId);
    const shouldSearchQQ =
      mode === "byQQ" || (mode === "auto" && /^\d+$/.test(queryText));
    const matches = members.filter((member) =>
      shouldSearchQQ
        ? getUserId(member) === queryText
        : matchByName(member, queryText),
    );

    if (matches.length === 0) return "未找到匹配的群成员。";

    const visibleMatches = matches.slice(0, MAX_RESULTS);
    const header =
      matches.length > MAX_RESULTS
        ? `仅显示前 ${MAX_RESULTS} 条，共 ${matches.length} 条匹配：`
        : `找到 ${matches.length} 个匹配成员：`;
    const message = [
      header,
      ...visibleMatches.map((member, index) => formatMember(index + 1, member)),
    ].join("\n");
    log?.("info", `群 ${resolvedGroupId} 成员搜索完成：${matches.length} 条匹配`);
    return message;
  } catch (error) {
    params.log?.("warn", "search_group_member failed", error);
    return `search_group_member failed: ${(error as Error).message}`;
  }
}

export function createSearchGroupMemberTool(
  deps: SearchGroupMemberToolDeps,
): StructuredTool {
  const { toolName, description, log } = deps;

  // @ts-ignore
  return new (class extends StructuredTool {
    name = toolName || "search_group_member";
    description = description || DEFAULT_SEARCH_GROUP_MEMBER_TOOL_DESCRIPTION;
    schema = z.object({
      groupId: z
        .string()
        .optional()
        .describe("Target group ID. Defaults to current session group."),
      query: z
        .string()
        .min(1, "query is required")
        .describe("qqid, group card, or QQ nickname to search."),
      mode: z
        .enum(["auto", "byName", "byQQ"])
        .optional()
        .describe("Search mode. Defaults to auto."),
    });

    async _call(
      input: {
        groupId?: string;
        query: string;
        mode?: SearchGroupMemberMode;
      },
      _manager?: unknown,
      runnable?: unknown,
    ) {
      return searchGroupMember({
        session: getSession(runnable),
        groupId: input.groupId,
        query: input.query,
        mode: input.mode,
        log,
      });
    }
  })();
}
