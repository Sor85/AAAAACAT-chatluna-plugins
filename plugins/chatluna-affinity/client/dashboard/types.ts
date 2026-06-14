export interface DashboardTopUser {
  userId: string;
  name: string;
  avatarUrl: string | null;
  affinity: number;
  relation: string;
  relationTone: "custom" | "low" | "medium" | "high" | "unknown";
  chatCount: number;
  lastInteractionAt: string | null;
  historyPoints: DashboardUserHistoryPoint[];
}

export interface DashboardRelationStat {
  relation: string;
  kind: "preset" | "custom";
  count: number;
}

export interface DashboardTrendPoint {
  label: string;
  users: number;
  averageAffinity: number;
  chatCount: number;
  blacklisted: number;
}

export interface DashboardMetricChange {
  current: number;
  previous: number;
  percent: number | null;
}

export interface DashboardUserHistoryPoint {
  label: string;
  timestamp: string | null;
  affinity: number;
}

export interface DashboardBlacklistItem {
  platform: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  affinity: number | null;
  mode: "permanent" | "temporary";
  blockedAt: string | null;
  expiresAt: string | null;
  note: string;
}

export interface DashboardData {
  scopeId: string;
  generatedAt: string;
  totals: {
    users: number;
    blacklisted: number;
    permanentBlacklisted: number;
    temporaryBlacklisted: number;
    aliases: number;
    chatCount: number;
  };
  averages: {
    affinity: number;
    longTermAffinity: number;
    shortTermAffinity: number;
  };
  latestInteractionAt: string | null;
  weeklyChanges: {
    users: DashboardMetricChange;
    averageAffinity: DashboardMetricChange;
    chatCount: DashboardMetricChange;
    aliases: DashboardMetricChange;
  };
  trends: {
    week: DashboardTrendPoint[];
    month: DashboardTrendPoint[];
    all: DashboardTrendPoint[];
  };
  relationStats: DashboardRelationStat[];
  blacklistItems: DashboardBlacklistItem[];
  topUsers: DashboardTopUser[];
}
