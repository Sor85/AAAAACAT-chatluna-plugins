export interface DashboardTopUser {
  userId: string;
  name: string;
  affinity: number;
  relation: string;
  chatCount: number;
  lastInteractionAt: string | null;
}

export interface DashboardRelationStat {
  relation: string;
  count: number;
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
  topUsers: DashboardTopUser[];
}
