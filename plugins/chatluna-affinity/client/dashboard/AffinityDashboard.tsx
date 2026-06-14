import { send } from "@koishijs/client";
import { Alert } from "@heroui/react/alert";
import { Avatar } from "@heroui/react/avatar";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Label } from "@heroui/react/label";
import { Pagination } from "@heroui/react/pagination";
import { ProgressBar } from "@heroui/react/progress-bar";
import { Spinner } from "@heroui/react/spinner";
import { Table } from "@heroui/react/table";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DashboardBlacklistItem,
  DashboardData,
  DashboardRelationStat,
  DashboardTopUser,
} from "./types";

const DASHBOARD_EVENT = "chatluna-affinity/dashboard";
const TOP_USER_PAGE_SIZE = 10;
const sortColumns = {
  affinity: true,
  chatCount: true,
  lastInteractionAt: true,
  relation: true,
  user: true,
};

type SortColumn = keyof typeof sortColumns;
type SortDirection = "ascending" | "descending";

interface TopUserSortDescriptor {
  column: SortColumn;
  direction: SortDirection;
}

function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatAverage(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTime(value: string | null): string {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getRelationClassName(tone: DashboardTopUser["relationTone"]): string {
  return `affinity-dashboard__relation affinity-dashboard__relation--${tone}`;
}

function isSortColumn(value: unknown): value is SortColumn {
  return typeof value === "string" && value in sortColumns;
}

function getUserSortName(user: DashboardTopUser): string {
  return `${user.name}\n${user.userId}`;
}

function getInteractionTimestamp(user: DashboardTopUser): number {
  if (!user.lastInteractionAt) return Number.NEGATIVE_INFINITY;
  const value = new Date(user.lastInteractionAt).getTime();
  return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "zh-CN", {
    numeric: true,
    sensitivity: "base",
  });
}

function compareTopUsers(
  left: DashboardTopUser,
  right: DashboardTopUser,
  sortDescriptor: TopUserSortDescriptor,
): number {
  let result = 0;

  switch (sortDescriptor.column) {
    case "user":
      result = compareText(getUserSortName(left), getUserSortName(right));
      break;
    case "relation":
      result = compareText(left.relation, right.relation);
      break;
    case "affinity":
      result = left.affinity - right.affinity;
      break;
    case "chatCount":
      result = left.chatCount - right.chatCount;
      break;
    case "lastInteractionAt":
      result = getInteractionTimestamp(left) - getInteractionTimestamp(right);
      break;
  }

  if (result === 0) {
    result = compareText(left.userId, right.userId);
  }

  return sortDescriptor.direction === "ascending" ? result : -result;
}

function SortableColumnHeader({
  children,
  sortDirection,
}: {
  children: React.ReactNode;
  sortDirection?: SortDirection;
}) {
  return (
    <span className="affinity-dashboard__sort-header">
      <span>{children}</span>
      {sortDirection ? (
        <Pagination.NextIcon
          className={`affinity-dashboard__sort-chevron affinity-dashboard__sort-chevron--${sortDirection}`}
        />
      ) : null}
    </span>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="affinity-dashboard__stat">
      <Card.Header>
        <Card.Description>{label}</Card.Description>
        <Card.Title>{value}</Card.Title>
      </Card.Header>
      <Card.Content>{detail}</Card.Content>
    </Card>
  );
}

function RelationProgress({
  item,
  total,
}: {
  item: DashboardRelationStat;
  total: number;
}) {
  const value = total > 0 ? Math.round((item.count / total) * 100) : 0;

  return (
    <ProgressBar
      aria-label={`${item.relation} 占比`}
      className="affinity-dashboard__progress"
      value={value}
    >
      <div className="affinity-dashboard__progress-label">
        <Label>{item.relation}</Label>
        <span>{formatNumber(item.count)} 人</span>
      </div>
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  );
}

function RelationList({
  items,
  total,
}: {
  items: DashboardRelationStat[];
  total: number;
}) {
  if (!items.length) {
    return <p className="affinity-dashboard__empty">当前 scopeId 暂无关系数据。</p>;
  }

  return (
    <div className="affinity-dashboard__relations">
      {items.slice(0, 6).map((item) => (
        <RelationProgress item={item} key={item.relation} total={total} />
      ))}
    </div>
  );
}

function TopUserTable({ users }: { users: DashboardTopUser[] }) {
  const [page, setPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] =
    useState<TopUserSortDescriptor>({
      column: "affinity",
      direction: "descending",
    });

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => compareTopUsers(left, right, sortDescriptor)),
    [sortDescriptor, users],
  );
  const pageCount = Math.max(1, Math.ceil(sortedUsers.length / TOP_USER_PAGE_SIZE));
  const pageUsers = useMemo(() => {
    const start = (page - 1) * TOP_USER_PAGE_SIZE;
    return sortedUsers.slice(start, start + TOP_USER_PAGE_SIZE);
  }, [page, sortedUsers]);
  const startRank = (page - 1) * TOP_USER_PAGE_SIZE + 1;
  const endRank = Math.min(page * TOP_USER_PAGE_SIZE, sortedUsers.length);

  useEffect(() => {
    setPage(1);
  }, [users]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  if (!users.length) {
    return <p className="affinity-dashboard__empty">当前 scopeId 暂无好感度记录。</p>;
  }

  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content
          aria-label="好感度排行"
          className="affinity-dashboard__table"
          sortDescriptor={sortDescriptor}
          onSortChange={(nextDescriptor) => {
            setSortDescriptor({
              column: isSortColumn(nextDescriptor.column)
                ? nextDescriptor.column
                : "affinity",
              direction: nextDescriptor.direction,
            });
            setPage(1);
          }}
        >
          <Table.Header>
            <Table.Column allowsSorting id="user" isRowHeader>
              {({ sortDirection }) => (
                <SortableColumnHeader sortDirection={sortDirection}>
                  用户
                </SortableColumnHeader>
              )}
            </Table.Column>
            <Table.Column allowsSorting id="relation">
              {({ sortDirection }) => (
                <SortableColumnHeader sortDirection={sortDirection}>
                  关系
                </SortableColumnHeader>
              )}
            </Table.Column>
            <Table.Column allowsSorting id="affinity">
              {({ sortDirection }) => (
                <SortableColumnHeader sortDirection={sortDirection}>
                  好感度
                </SortableColumnHeader>
              )}
            </Table.Column>
            <Table.Column allowsSorting id="chatCount">
              {({ sortDirection }) => (
                <SortableColumnHeader sortDirection={sortDirection}>
                  互动
                </SortableColumnHeader>
              )}
            </Table.Column>
            <Table.Column allowsSorting id="lastInteractionAt">
              {({ sortDirection }) => (
                <SortableColumnHeader sortDirection={sortDirection}>
                  最后互动
                </SortableColumnHeader>
              )}
            </Table.Column>
          </Table.Header>
          <Table.Body>
            {pageUsers.map((user) => (
              <Table.Row id={user.userId} key={user.userId}>
                <Table.Cell>
                  <div className="affinity-dashboard__rank-user">
                    <Avatar size="sm" variant="soft">
                      {user.avatarUrl ? (
                        <Avatar.Image
                          alt={`${user.name} 的头像`}
                          loading="lazy"
                          src={user.avatarUrl}
                        />
                      ) : null}
                      <Avatar.Fallback>
                        {user.name.trim().slice(0, 1) || "?"}
                      </Avatar.Fallback>
                    </Avatar>
                    <div className="affinity-dashboard__user">
                      <span>{user.name}</span>
                      <small>{user.userId}</small>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Chip
                    className={getRelationClassName(user.relationTone)}
                    size="sm"
                    variant="soft"
                  >
                    {user.relation}
                  </Chip>
                </Table.Cell>
                <Table.Cell>{formatNumber(user.affinity)}</Table.Cell>
                <Table.Cell>{formatNumber(user.chatCount)}</Table.Cell>
                <Table.Cell>{formatTime(user.lastInteractionAt)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
      {pageCount > 1 ? (
        <Table.Footer className="affinity-dashboard__table-footer">
          <Pagination className="affinity-dashboard__pagination" size="sm">
            <Pagination.Summary className="affinity-dashboard__pagination-summary">
              第 {formatNumber(page)} / {formatNumber(pageCount)} 页，显示{" "}
              {formatNumber(startRank)}-{formatNumber(endRank)} /{" "}
              {formatNumber(sortedUsers.length)}
            </Pagination.Summary>
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={page === 1}
                  onPress={() => setPage((currentPage) => currentPage - 1)}
                >
                  <Pagination.PreviousIcon />
                  上一页
                </Pagination.Previous>
              </Pagination.Item>
              <Pagination.Item>
                <Pagination.Link isActive>{formatNumber(page)}</Pagination.Link>
              </Pagination.Item>
              <Pagination.Item>
                <Pagination.Next
                  isDisabled={page === pageCount}
                  onPress={() => setPage((currentPage) => currentPage + 1)}
                >
                  下一页
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </Table.Footer>
      ) : null}
    </Table>
  );
}

function BlacklistList({ items }: { items: DashboardBlacklistItem[] }) {
  if (!items.length) {
    return <p className="affinity-dashboard__empty">当前 scopeId 暂无黑名单记录。</p>;
  }

  return (
    <div className="affinity-dashboard__blacklist">
      {items.map((item) => (
        <div
          className="affinity-dashboard__blacklist-item"
          key={`${item.mode}:${item.platform}:${item.userId}`}
        >
          <div className="affinity-dashboard__blacklist-main">
            <div className="affinity-dashboard__blacklist-user">
              <strong>{item.name}</strong>
              <span>{item.userId}</span>
            </div>
            <Chip
              color={item.mode === "permanent" ? "danger" : "warning"}
              size="sm"
              variant="soft"
            >
              {item.mode === "permanent" ? "永久" : "临时"}
            </Chip>
          </div>
          <div className="affinity-dashboard__blacklist-meta">
            <span>{item.platform}</span>
            <span>
              好感度{" "}
              {item.affinity === null ? "暂无" : formatNumber(item.affinity)}
            </span>
            <span>加入 {formatTime(item.blockedAt)}</span>
            {item.expiresAt ? <span>到期 {formatTime(item.expiresAt)}</span> : null}
          </div>
          {item.note ? (
            <p className="affinity-dashboard__blacklist-note">{item.note}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DashboardContent({ data }: { data: DashboardData }) {
  const activeRelationStats = useMemo(
    () => data.relationStats.filter((item) => item.count > 0),
    [data.relationStats],
  );

  return (
    <>
      <div className="affinity-dashboard__summary">
        <StatCard
          detail={`黑名单 ${formatNumber(data.totals.blacklisted)} 人`}
          label="用户记录"
          value={formatNumber(data.totals.users)}
        />
        <StatCard
          detail={`长期均值 ${formatAverage(data.averages.longTermAffinity)}`}
          label="平均好感度"
          value={formatAverage(data.averages.affinity)}
        />
        <StatCard
          detail={`短期均值 ${formatAverage(data.averages.shortTermAffinity)}`}
          label="互动次数"
          value={formatNumber(data.totals.chatCount)}
        />
        <StatCard
          detail={`最近互动 ${formatTime(data.latestInteractionAt)}`}
          label="昵称记录"
          value={formatNumber(data.totals.aliases)}
        />
      </div>

      <div className="affinity-dashboard__grid">
        <Card>
          <Card.Header>
            <Card.Title>黑名单列表</Card.Title>
            <Card.Description>
              当前 scopeId 下最近的 {formatNumber(data.blacklistItems.length)} 条记录
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <BlacklistList items={data.blacklistItems} />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>关系分布</Card.Title>
            <Card.Description>按用户当前展示关系统计</Card.Description>
          </Card.Header>
          <Card.Content>
            <RelationList items={activeRelationStats} total={data.totals.users} />
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>好感度排行</Card.Title>
          <Card.Description>
            默认按好感度从高到低排序，每页 10 名
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <TopUserTable users={data.topUsers} />
        </Card.Content>
      </Card>
    </>
  );
}

export function AffinityDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextData = await send(DASHBOARD_EVENT);
      setData(nextData as DashboardData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="affinity-dashboard">
      <div className="affinity-dashboard__header">
        <div>
          <h2>好感度仪表盘</h2>
          <p>当前 scopeId 下的真实统计数据</p>
        </div>
        <Button isDisabled={loading} size="sm" variant="secondary" onPress={load}>
          <RefreshIcon />
          刷新
        </Button>
      </div>

      {loading && !data ? (
        <Card className="affinity-dashboard__loading">
          <Spinner color="accent" />
          <span>正在读取仪表盘数据</span>
        </Card>
      ) : null}

      {error ? (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>仪表盘数据读取失败</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {data ? <DashboardContent data={data} /> : null}
    </section>
  );
}
