/**
 * thoughts runtime 监听
 * 复用 shared runtime 提取模型输出中的目标标签内容
 */

import type { Session } from "koishi";
import {
  createCharacterTempRuntime,
  type CharacterServiceLike as SharedCharacterServiceLike,
  type CompletionMessagesLike,
  type TempLike,
} from "shared-chatluna-xmltools";
import type { Config, LogFn, ThinkStore } from "../types";
import { buildThoughtStoreKey } from "../store/think-store";
import { parseTagContent } from "../xml/parse-think-content";

interface GroupTempLike extends TempLike {
  completionMessages?: CompletionMessagesLike;
}

export interface CharacterServiceLike
  extends SharedCharacterServiceLike<GroupTempLike> {
  getTemp?: (...args: unknown[]) => Promise<GroupTempLike>;
}

export interface ThinkRuntime {
  start: () => boolean;
  stop: () => void;
  isActive: () => boolean;
}

export interface CreateThinkRuntimeParams {
  getCharacterService: () => CharacterServiceLike | null | undefined;
  config: Config;
  store: ThinkStore;
  log?: LogFn;
}

export function buildStoredThought(
  response: string,
  monitoredTag: string,
): string | null {
  const parsed = parseTagContent(response, monitoredTag);
  const thoughts = parsed.thoughts
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (thoughts.length === 0) return null;

  return thoughts.join("\n\n");
}

export function createThinkRuntime(params: CreateThinkRuntimeParams): ThinkRuntime {
  const { getCharacterService, config, store, log } = params;

  return createCharacterTempRuntime<GroupTempLike, Session>({
    getCharacterService,
    symbolNamespace: "chatluna-thoughts-viewer",
    resolveSession: (args) =>
      args[0] && typeof args[0] === "object" ? (args[0] as Session) : null,
    onServiceMissing: () => {
      if (!config.debugLogging) return;
      log?.("warn", "chatluna_character.getTemp 不可用，思考监听未启用");
    },
    onListenerError: (error) => {
      log?.("warn", "监听模型回复失败", error);
    },
    onResponseError: (error) => {
      log?.("warn", "处理思考内容失败", error);
    },
    onResponse: async ({ response, session }) => {
      if (!session) return;

      const key = buildThoughtStoreKey(session);
      if (!key) return;

      const content = buildStoredThought(response, config.monitoredTag);
      if (!content) return;

      store.update(key, content);

      if (config.debugLogging) {
        log?.("debug", `已缓存思考内容，长度=${content.length}`);
      }
    },
  });
}
