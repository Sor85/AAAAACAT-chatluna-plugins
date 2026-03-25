/**
 * 成员信息相关类型定义
 * 包含群成员信息、角色映射、群信息等类型
 */

import type { LogFn } from "./common";

export type MemberInfoField =
  | "nickname"
  | "userId"
  | "role"
  | "level"
  | "title"
  | "gender"
  | "age"
  | "area"
  | "joinTime"
  | "lastSentTime"
  | "chatCount";

export interface MemberInfo {
  card?: string;
  remark?: string;
  displayName?: string;
  nick?: string;
  nickname?: string;
  name?: string;
  user?: { nickname?: string; name?: string };
  level?: string | number;
  levelName?: string;
  level_name?: string;
  level_info?: { current_level?: string | number; level?: string | number };
  title?: string;
  specialTitle?: string;
  special_title?: string;
  sex?: string;
  gender?: string;
  age?: number;
  area?: string;
  region?: string;
  location?: string;
  join_time?: number | string;
  joined_at?: number | string;
  joinTime?: number | string;
  joinedAt?: number | string;
  joinTimestamp?: number | string;
  last_sent_time?: number | string;
  lastSentTime?: number | string;
  lastSpeakTimestamp?: number | string;
  role?: string;
  roleName?: string;
  permission?: string;
  permissions?: string | string[];
  identity?: string;
  type?: string;
  status?: string;
  roles?: string[];
  userId?: string;
  id?: string;
  qq?: string;
  uid?: string;
  user_id?: string;
}

export interface RenderMemberInfoOptions {
  fallbackNames?: string[];
  defaultItems?: MemberInfoField[];
  logUnknown?: boolean;
  log?: LogFn;
  chatCount?: number;
}

export interface RoleTranslation {
  role: string;
  matched: boolean;
  raw: unknown;
}

export interface RoleMapping {
  direct: Record<string, string>;
  keywords: Record<string, string[]>;
  numeric: Record<string, string>;
}
