/**
 * 配置相关类型定义
 * 包含插件配置及各子模块配置类型
 */

export interface BaseAffinityConfig {
  initialRandomMin: number;
  initialRandomMax: number;
  maxIncreasePerMessage: number;
  maxDecreasePerMessage: number;
}

export interface ShortTermConfig {
  promoteThreshold: number;
  demoteThreshold: number;
  longTermPromoteStep: number;
  longTermDemoteStep: number;
  longTermStep?: number;
  resetBiasRange?: number;
}

export interface ActionWindowConfig {
  windowHours: number;
  increaseBonus: number;
  decreaseBonus: number;
  bonusChatThreshold: number;
  allowBonusOverflow: boolean;
  maxEntries: number;
}

export interface CoefficientConfig {
  base: number;
  maxDrop: number;
  maxBoost: number;
  decayPerDay: number;
  boostPerDay: number;
}

export interface AffinityDynamicsConfig {
  shortTerm?: Partial<ShortTermConfig>;
  actionWindow?: Partial<ActionWindowConfig>;
  coefficient?: Partial<CoefficientConfig>;
}

export interface RelationshipLevel {
  min: number;
  max: number;
  relation: string;
  note?: string;
}

export interface ManualRelationship {
  userId: string;
  relation: string;
  note?: string;
}

export interface AffinityGroup {
  groupName: string;
  botIds: string[];
}

export interface VariableSettings {
  affinityVariableName: string;
  relationshipAffinityLevelVariableName: string;
  blacklistListVariableName: string;
  userAliasVariableName: string;
}

export interface NativeToolSettings {
  registerRelationshipTool: boolean;
  relationshipToolName: string;
  registerBlacklistTool: boolean;
  blacklistToolName: string;
}

export interface XmlToolSettings {
  enableAffinityXmlToolCall: boolean;
  enableBlacklistXmlToolCall: boolean;
  enableRelationshipXmlToolCall: boolean;
  enableUserAliasXmlToolCall: boolean;
  characterPromptTemplate: string;
}

export interface Config {
  affinityEnabled: boolean;
  affinityDisplayRange: number;
  baseAffinityConfig: BaseAffinityConfig;
  initialRandomMin: number;
  initialRandomMax: number;
  maxIncreasePerMessage: number;
  maxDecreasePerMessage: number;
  affinityDynamics: AffinityDynamicsConfig;
  blacklistLogInterception: boolean;
  shortTermBlacklistPenalty: number;
  rankDefaultLimit: number;
  rankRenderAsImage: boolean;
  blacklistDefaultLimit: number;
  inspectRenderAsImage: boolean;
  inspectShowImpression: boolean;
  debugLogging: boolean;
  blacklistRenderAsImage: boolean;
  shortTermBlacklistRenderAsImage: boolean;
  affinityGroups: AffinityGroup[];
  relationships: ManualRelationship[];
  relationshipAffinityLevels: RelationshipLevel[];
  variableSettings: VariableSettings;
  nativeToolSettings: NativeToolSettings;
  xmlToolSettings: XmlToolSettings;
}
