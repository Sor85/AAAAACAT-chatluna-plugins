/**
 * 用户自定义昵称类型定义
 * 包含数据库记录与变量输出结构
 */

export interface UserAliasRecord {
  platform: string;
  userId: string;
  alias: string;
  updatedAt: Date;
}
