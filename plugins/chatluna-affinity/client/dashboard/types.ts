export interface DashboardTopUser {
  userId: string;
  name: string;
  avatarUrl: string | null;
  affinity: number;
  relation: string;
  relationTone: "custom" | "low" | "medium" | "high" | "unknown";
  chatCount: number;
  lastInteractionAt: string | null;
}

export interface DashboardRelationStat {
  relation: string;
  count: number;
}

export interface DashboardBlacklistItem {
  platform: string;
  userId: string;
  name: string;
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
  relationStats: DashboardRelationStat[];
  blacklistItems: DashboardBlacklistItem[];
  topUsers: DashboardTopUser[];
}
