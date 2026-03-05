/**
 * 前端类型定义
 * 包含配置接口和组件 Props 类型
 */

export interface BlacklistEntry {
  userId: string;
  nickname: string;
  blockedAt: string;
  note: string;
  platform: string;
}

export interface TemporaryBlacklistEntry {
  userId: string;
  nickname: string;
  blockedAt: string;
  expiresAt: string;
  durationHours: string;
  penalty: string;
  note: string;
  platform: string;
}

export interface AffinityGroup {
  groupName: string;
  botIds: string[];
}

export interface VariableSettings {
  affinityVariableName?: string;
  relationshipAffinityLevelVariableName?: string;
  blacklistListVariableName?: string;
  userAliasVariableName?: string;
}

export interface NativeToolSettings {
  registerRelationshipTool?: boolean;
  relationshipToolName?: string;
  registerBlacklistTool?: boolean;
  blacklistToolName?: string;
}

export interface XmlToolSettings {
  enableAffinityXmlToolCall?: boolean;
  enableBlacklistXmlToolCall?: boolean;
  enableRelationshipXmlToolCall?: boolean;
  enableUserAliasXmlToolCall?: boolean;
  characterPromptTemplate?: string;
}

export interface FrontendConfigSubset {
  affinityEnabled?: boolean;
  affinityDisplayRange?: number;
  rankRenderAsImage?: boolean;
  rankDefaultLimit?: number;

  blacklistLogInterception?: boolean;
  blacklistDefaultLimit?: number;
  blacklistRenderAsImage?: boolean;
  shortTermBlacklistRenderAsImage?: boolean;

  inspectRenderAsImage?: boolean;
  inspectShowImpression?: boolean;
  debugLogging?: boolean;
  affinityGroups?: AffinityGroup[];

  variableSettings?: VariableSettings;
  nativeToolSettings?: NativeToolSettings;
  xmlToolSettings?: XmlToolSettings;

  affinityVariableName?: string;
  relationshipAffinityLevelVariableName?: string;
  blacklistListVariableName?: string;
  userAliasVariableName?: string;
}
