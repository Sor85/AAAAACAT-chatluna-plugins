import { send } from "@koishijs/client";
import { Tooltip } from "@heroui/react/tooltip";
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconLoader2,
  IconMinus,
  IconRefresh,
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../components/ui/alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Toaster } from "../components/ui/sonner";
import type {
  DashboardBlacklistItem,
  DashboardData,
  DashboardMetricChange,
  DashboardRelationStat,
  DashboardTopUser,
} from "./types";

const DASHBOARD_EVENT = "chatluna-affinity/dashboard";
const TOP_USER_PAGE_SIZE = 10;

type SortColumn =
  | "affinity"
  | "chatCount"
  | "lastInteractionAt"
  | "relation"
  | "user"
  | "userId";
type SortDirection = "ascending" | "descending";
type TrendRange = "week" | "month" | "all";

interface TopUserSortDescriptor {
  column: SortColumn;
  direction: SortDirection;
}

const trendChartConfig = {
  users: {
    label: "用户记录",
    color: "var(--chart-1)",
  },
  averageAffinity: {
    label: "平均好感",
    color: "var(--chart-2)",
  },
  chatCount: {
    label: "互动次数",
    color: "var(--chart-3)",
  },
  blacklisted: {
    label: "黑名单",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

const userHistoryChartConfig = {
  affinity: {
    label: "综合好感",
    color: "var(--chart-2)",
  },
  longTermAffinity: {
    label: "长期好感",
    color: "var(--chart-3)",
  },
  chatCount: {
    label: "对话次数",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

const USER_HISTORY_DAY_MS = 24 * 60 * 60 * 1000;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatAverage(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getHistoryWindowDays(range: TrendRange): number {
  if (range === "month") return 30;
  if (range === "all") return Number.POSITIVE_INFINITY;
  return 7;
}

function getUserHistoryData(
  points: DashboardTopUser["historyPoints"],
  range: TrendRange,
): DashboardTopUser["historyPoints"] {
  if (!points.length) return points;
  if (range === "all") return points;

  const latest = points.at(-1);
  const latestDate = latest?.timestamp ? new Date(latest.timestamp) : null;
  if (!latestDate || Number.isNaN(latestDate.getTime())) return points;

  const windowDays = getHistoryWindowDays(range);
  const anchor = startOfLocalDay(latestDate);
  const start = anchor.getTime() - (windowDays - 1) * USER_HISTORY_DAY_MS;
  const filtered = points.filter((point) => {
    if (!point.timestamp) return false;
    const date = new Date(point.timestamp);
    const time = date.getTime();
    return !Number.isNaN(time) && time >= start;
  });

  if (!filtered.length) return [latest];

  const firstVisibleIndex = points.findIndex((point) => {
    if (!point.timestamp) return false;
    const date = new Date(point.timestamp);
    const time = date.getTime();
    return !Number.isNaN(time) && time >= start;
  });
  if (firstVisibleIndex > 0) {
    const anchorPoint = points[firstVisibleIndex - 1];
    if (anchorPoint?.timestamp) {
      const anchorDatePoint = new Date(anchorPoint.timestamp);
      if (!Number.isNaN(anchorDatePoint.getTime())) {
        const result = [anchorPoint, ...filtered];
        return result.filter(
          (point, index, list) =>
            index === 0 ||
            point.timestamp !== list[index - 1]?.timestamp,
        );
      }
    }
  }

  return filtered;
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

function formatChange(change: DashboardMetricChange): string {
  if (change.percent === null) return "上周无基准";
  if (change.percent > 0) return `较上周 +${formatAverage(change.percent)}%`;
  if (change.percent < 0) return `较上周 ${formatAverage(change.percent)}%`;
  return "较上周持平";
}

function ChangeIcon({ change }: { change: DashboardMetricChange }) {
  if (change.percent === null || change.percent === 0) {
    return <IconMinus aria-hidden="true" />;
  }
  if (change.percent > 0) {
    return <IconTrendingUp aria-hidden="true" />;
  }
  return <IconTrendingDown aria-hidden="true" />;
}

function getUserSortName(user: DashboardTopUser): string {
  return user.name;
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
    case "userId":
      result = compareText(left.userId, right.userId);
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

function getRelationBadgeClassName(
  tone: DashboardTopUser["relationTone"],
): string {
  switch (tone) {
    case "low":
      return "border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-100";
    case "medium":
      return "border-sky-200 bg-sky-100 text-sky-900 hover:bg-sky-100";
    case "high":
      return "border-emerald-200 bg-emerald-100 text-emerald-900 hover:bg-emerald-100";
    case "custom":
      return "border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-100";
    case "unknown":
      return "border-muted bg-muted text-muted-foreground hover:bg-muted";
  }
}

function OverflowTooltip({
  children,
  content,
  className,
}: {
  children: React.ReactNode;
  content: string;
  className?: string;
}) {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const checkOverflow = () => {
      const target =
        trigger.firstElementChild instanceof HTMLElement
          ? trigger.firstElementChild
          : trigger;

      setIsOverflowing(
        target.scrollWidth > target.clientWidth ||
          trigger.scrollWidth > trigger.clientWidth,
      );
    };

    checkOverflow();
    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(trigger);

    return () => resizeObserver.disconnect();
  }, [content]);

  return (
    <Tooltip closeDelay={0} delay={0} isDisabled={!isOverflowing}>
      <Tooltip.Trigger
        ref={triggerRef}
        className={
          className
            ? `block w-full min-w-0 ${className}`
            : "block w-full min-w-0"
        }
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Content showArrow>{content}</Tooltip.Content>
    </Tooltip>
  );
}

function SortHeader({
  children,
  column,
  sortDescriptor,
  onSortChange,
}: {
  children: React.ReactNode;
  column: SortColumn;
  sortDescriptor: TopUserSortDescriptor;
  onSortChange: (next: TopUserSortDescriptor) => void;
}) {
  const active = sortDescriptor.column === column;
  const nextDirection: SortDirection =
    active && sortDescriptor.direction === "descending"
      ? "ascending"
      : "descending";

  return (
    <Button
      className="h-auto w-full justify-start px-0 py-0 font-medium text-muted-foreground hover:bg-transparent"
      type="button"
      variant="ghost"
      onClick={() =>
        onSortChange({
          column,
          direction: nextDirection,
        })
      }
    >
      <span>{children}</span>
      {active ? (
        sortDescriptor.direction === "ascending" ? (
          <IconChevronUp aria-hidden="true" />
        ) : (
          <IconChevronDown aria-hidden="true" />
        )
      ) : null}
    </Button>
  );
}

function StatCard({
  label,
  value,
  detail,
  change,
}: {
  label: string;
  value: string;
  detail: string;
  change: DashboardMetricChange;
}) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <CardDescription>{label}</CardDescription>
          <Badge className="gap-1" variant="outline">
            <ChangeIcon change={change} />
            {formatChange(change)}
          </Badge>
        </div>
        <CardTitle className="text-2xl">{value}</CardTitle>
        <div className="text-sm text-muted-foreground">{detail}</div>
      </CardHeader>
    </Card>
  );
}

function OverviewTrendChart({
  trends,
}: {
  trends: DashboardData["trends"];
}) {
  const [range, setRange] = useState<TrendRange>("week");
  const chartData = trends[range];

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <CardTitle>趋势概览</CardTitle>
          <CardDescription>用户记录、平均好感、互动次数与黑名单</CardDescription>
        </div>
        <Tabs value={range} onValueChange={(value) => setRange(value as TrendRange)}>
          <TabsList>
            <TabsTrigger value="week">周</TabsTrigger>
            <TabsTrigger value="month">月</TabsTrigger>
            <TabsTrigger value="all">总</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {chartData.length ? (
          <ChartContainer className="h-72 w-full" config={trendChartConfig}>
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{ left: 8, right: 8 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                tickLine={false}
                tickMargin={8}
              />
              <YAxis axisLine={false} tickLine={false} width={36} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey="users"
                dot={false}
                stroke="var(--color-users)"
                strokeWidth={2}
                type="monotone"
              />
              <Line
                dataKey="averageAffinity"
                dot={false}
                stroke="var(--color-averageAffinity)"
                strokeWidth={2}
                type="monotone"
              />
              <Line
                dataKey="chatCount"
                dot={false}
                stroke="var(--color-chatCount)"
                strokeWidth={2}
                type="monotone"
              />
              <Line
                dataKey="blacklisted"
                dot={false}
                stroke="var(--color-blacklisted)"
                strokeWidth={2}
                type="monotone"
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className="affinity-dashboard__empty">当前 scopeId 暂无趋势数据。</p>
        )}
      </CardContent>
    </Card>
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
    <div className="grid gap-3">
      {items.slice(0, 8).map((item) => {
        const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;

        return (
          <div className="grid gap-2" key={`${item.kind}:${item.relation}`}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{item.relation}</span>
              <span className="text-muted-foreground">
                {formatNumber(item.count)} 人
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RelationshipDistribution({
  items,
  total,
}: {
  items: DashboardRelationStat[];
  total: number;
}) {
  const presetItems = items.filter((item) => item.kind === "preset");
  const customItems = items.filter((item) => item.kind === "custom");

  return (
    <Card>
      <CardHeader>
        <CardTitle>关系分布</CardTitle>
        <CardDescription>按用户当前展示关系统计</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="preset">
          <TabsList className="self-start">
            <TabsTrigger value="preset">预设关系</TabsTrigger>
            <TabsTrigger value="custom">自定义关系</TabsTrigger>
          </TabsList>
          <TabsContent value="preset">
            <RelationList items={presetItems} total={total} />
          </TabsContent>
          <TabsContent value="custom">
            <RelationList items={customItems} total={total} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function TopUserTable({
  users,
  selectedUserId,
  onSelectUser,
}: {
  users: DashboardTopUser[];
  selectedUserId: string | null;
  onSelectUser: (user: DashboardTopUser) => void;
}) {
  const [page, setPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] =
    useState<TopUserSortDescriptor>({
      column: "affinity",
      direction: "descending",
    });

  const sortedUsers = useMemo(
    () =>
      [...users].sort((left, right) =>
        compareTopUsers(left, right, sortDescriptor),
      ),
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
    <div className="grid gap-3">
      <Table className="min-w-[960px] table-fixed">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[17%]" />
          <col className="w-[13%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[22%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortHeader
                column="user"
                sortDescriptor={sortDescriptor}
                onSortChange={setSortDescriptor}
              >
                用户
              </SortHeader>
            </TableHead>
            <TableHead>
              <SortHeader
                column="userId"
                sortDescriptor={sortDescriptor}
                onSortChange={setSortDescriptor}
              >
                QQ号
              </SortHeader>
            </TableHead>
            <TableHead>
              <SortHeader
                column="relation"
                sortDescriptor={sortDescriptor}
                onSortChange={setSortDescriptor}
              >
                关系
              </SortHeader>
            </TableHead>
            <TableHead>
              <SortHeader
                column="affinity"
                sortDescriptor={sortDescriptor}
                onSortChange={setSortDescriptor}
              >
                好感度
              </SortHeader>
            </TableHead>
            <TableHead>
              <SortHeader
                column="chatCount"
                sortDescriptor={sortDescriptor}
                onSortChange={setSortDescriptor}
              >
                互动
              </SortHeader>
            </TableHead>
            <TableHead>
              <SortHeader
                column="lastInteractionAt"
                sortDescriptor={sortDescriptor}
                onSortChange={setSortDescriptor}
              >
                最后互动
              </SortHeader>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageUsers.map((user, index) => {
            const selected = selectedUserId === user.userId;
            const affinity = formatNumber(user.affinity);
            const chatCount = formatNumber(user.chatCount);
            const lastInteractionAt = formatTime(user.lastInteractionAt);
            const rowClassName = selected
              ? "cursor-pointer border-0 bg-muted/70 hover:bg-muted/70"
              : index % 2 === 0
                ? "cursor-pointer border-0 bg-muted/50 hover:bg-muted/60"
                : "cursor-pointer border-0 bg-background hover:bg-muted/60";

            return (
              <React.Fragment key={user.userId}>
                <TableRow
                  className={rowClassName}
                  onClick={() => onSelectUser(user)}
                >
                  <TableCell className="text-left">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar>
                        {user.avatarUrl ? (
                          <AvatarImage
                            alt={`${user.name} 的头像`}
                            loading="lazy"
                            src={user.avatarUrl}
                          />
                        ) : null}
                        <AvatarFallback>
                          {user.name.trim().slice(0, 1) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid min-w-0 gap-0.5">
                        <OverflowTooltip content={user.name}>
                          <span className="block truncate font-medium">
                            {user.name}
                          </span>
                        </OverflowTooltip>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-left">
                    <OverflowTooltip content={user.userId}>
                      <span className="block truncate text-muted-foreground">
                        {user.userId}
                      </span>
                    </OverflowTooltip>
                  </TableCell>
                  <TableCell className="text-left">
                    <OverflowTooltip content={user.relation}>
                      <Badge
                        className={`max-w-full truncate ${getRelationBadgeClassName(user.relationTone)}`}
                        variant="outline"
                      >
                        {user.relation}
                      </Badge>
                    </OverflowTooltip>
                  </TableCell>
                  <TableCell className="text-left">
                    <OverflowTooltip content={affinity}>{affinity}</OverflowTooltip>
                  </TableCell>
                  <TableCell className="text-left">
                    <OverflowTooltip content={chatCount}>{chatCount}</OverflowTooltip>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-left">
                    <OverflowTooltip content={lastInteractionAt}>
                      {lastInteractionAt}
                    </OverflowTooltip>
                  </TableCell>
                </TableRow>
                {selected ? (
                  <TableRow className="border-0 bg-muted/70 hover:bg-muted/70">
                    <TableCell colSpan={6}>
                      <UserHistoryChart user={user} />
                    </TableCell>
                  </TableRow>
                ) : null}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            第 {formatNumber(page)} / {formatNumber(pageCount)} 页，显示{" "}
            {formatNumber(startRank)}-{formatNumber(endRank)} /{" "}
            {formatNumber(sortedUsers.length)}
          </span>
          <div className="flex items-center gap-2">
            <Button
              disabled={page === 1}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => setPage((currentPage) => currentPage - 1)}
            >
              上一页
            </Button>
            <Button
              disabled={page === pageCount}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => setPage((currentPage) => currentPage + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BlacklistTable({ items }: { items: DashboardBlacklistItem[] }) {
  if (!items.length) {
    return <p className="affinity-dashboard__empty">当前 scopeId 暂无黑名单记录。</p>;
  }

  return (
    <Table className="table-fixed">
      <colgroup>
        <col className="w-[18%]" />
        <col className="w-[13%]" />
        <col className="w-[18%]" />
        <col className="w-[8%]" />
        <col className="w-[8%]" />
        <col className="w-[8%]" />
        <col className="w-[13.5%]" />
        <col className="w-[13.5%]" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>用户</TableHead>
          <TableHead>QQ号</TableHead>
          <TableHead>理由</TableHead>
          <TableHead>模式</TableHead>
          <TableHead>平台</TableHead>
          <TableHead>好感度</TableHead>
          <TableHead>加入时间</TableHead>
          <TableHead>到期时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => (
          <TableRow
            className={
              index % 2 === 0
                ? "border-0 bg-muted/50 hover:bg-muted/60"
                : "border-0 bg-background hover:bg-muted/60"
            }
            key={`${item.mode}:${item.platform}:${item.userId}`}
          >
            <TableCell className="text-left">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar>
                  {item.avatarUrl ? (
                    <AvatarImage
                      alt={`${item.name} 的头像`}
                      loading="lazy"
                      src={item.avatarUrl}
                    />
                  ) : null}
                  <AvatarFallback>
                    {item.name.trim().slice(0, 1) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 gap-0.5">
                  <OverflowTooltip content={item.name}>
                    <span className="block truncate font-medium">
                      {item.name}
                    </span>
                  </OverflowTooltip>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-left">
              <OverflowTooltip content={item.userId}>
                <span className="block truncate text-muted-foreground">
                  {item.userId}
                </span>
              </OverflowTooltip>
            </TableCell>
            <TableCell className="text-left">
              <OverflowTooltip content={item.note || "暂无"}>
                <span className="block truncate text-muted-foreground">
                  {item.note || "暂无"}
                </span>
              </OverflowTooltip>
            </TableCell>
            <TableCell className="text-left">
              <Badge variant={item.mode === "permanent" ? "destructive" : "secondary"}>
                {item.mode === "permanent" ? "永久" : "临时"}
              </Badge>
            </TableCell>
            <TableCell className="text-left">
              <OverflowTooltip content={item.platform}>
                <span className="block truncate">{item.platform}</span>
              </OverflowTooltip>
            </TableCell>
            <TableCell className="text-left">
              <OverflowTooltip
                content={item.affinity === null ? "暂无" : formatNumber(item.affinity)}
              >
                <span className="block truncate">
                  {item.affinity === null ? "暂无" : formatNumber(item.affinity)}
                </span>
              </OverflowTooltip>
            </TableCell>
            <TableCell className="whitespace-nowrap text-left">
              <OverflowTooltip content={formatTime(item.blockedAt)}>
                <span className="block truncate">{formatTime(item.blockedAt)}</span>
              </OverflowTooltip>
            </TableCell>
            <TableCell className="whitespace-nowrap text-left">
              <OverflowTooltip content={formatTime(item.expiresAt)}>
                <span className="block truncate">{formatTime(item.expiresAt)}</span>
              </OverflowTooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function UserHistoryChart({ user }: { user: DashboardTopUser }) {
  const [range, setRange] = useState<TrendRange>("week");
  const historyPoints = useMemo(
    () => getUserHistoryData(user.historyPoints, range),
    [range, user.historyPoints],
  );

  return (
    <div className="grid gap-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{user.name} 的好感度历史</h3>
        <Tabs
          value={range}
          onValueChange={(value) => setRange(value as TrendRange)}
        >
          <TabsList>
            <TabsTrigger value="week">周</TabsTrigger>
            <TabsTrigger value="month">月</TabsTrigger>
            <TabsTrigger value="all">总</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <ChartContainer className="h-56 w-full" config={userHistoryChartConfig}>
        <LineChart
          accessibilityLayer
          data={historyPoints}
          margin={{ left: 8, right: 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis axisLine={false} dataKey="label" tickLine={false} tickMargin={8} />
          <YAxis axisLine={false} tickLine={false} width={36} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="affinity"
            dot={{ fill: "var(--color-affinity)" }}
            stroke="var(--color-affinity)"
            strokeWidth={2}
            type="monotone"
          />
          <Line
            dataKey="longTermAffinity"
            dot={{ fill: "var(--color-longTermAffinity)" }}
            stroke="var(--color-longTermAffinity)"
            strokeWidth={2}
            type="monotone"
          />
          <Line
            dataKey="chatCount"
            dot={{ fill: "var(--color-chatCount)" }}
            stroke="var(--color-chatCount)"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

function RankingPanel({
  data,
}: {
  data: DashboardData;
}) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedUserId((current) =>
      current && data.topUsers.some((user) => user.userId === current) ? current : null,
    );
  }, [data.topUsers]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>好感度排行</CardTitle>
        <CardDescription>默认按好感度从高到低排序，每页 10 名</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ranking">
          <TabsList className="self-start">
            <TabsTrigger value="ranking">好感度</TabsTrigger>
            <TabsTrigger value="blacklist">黑名单</TabsTrigger>
          </TabsList>
          <TabsContent value="ranking">
            <div className="grid gap-4">
              <TopUserTable
                selectedUserId={selectedUserId}
                users={data.topUsers}
                onSelectUser={(user) =>
                  setSelectedUserId((current) =>
                    current === user.userId ? null : user.userId,
                  )
                }
              />
            </div>
          </TabsContent>
          <TabsContent value="blacklist">
            <BlacklistTable items={data.blacklistItems} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function DashboardContent({ data }: { data: DashboardData }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          change={data.weeklyChanges.users}
          detail={`黑名单 ${formatNumber(data.totals.blacklisted)} 人`}
          label="用户记录"
          value={formatNumber(data.totals.users)}
        />
        <StatCard
          change={data.weeklyChanges.averageAffinity}
          detail={`长期均值 ${formatAverage(data.averages.longTermAffinity)}`}
          label="平均好感度"
          value={formatAverage(data.averages.affinity)}
        />
        <StatCard
          change={data.weeklyChanges.chatCount}
          detail={`短期均值 ${formatAverage(data.averages.shortTermAffinity)}`}
          label="互动次数"
          value={formatNumber(data.totals.chatCount)}
        />
        <StatCard
          change={data.weeklyChanges.aliases}
          detail={`最近互动 ${formatTime(data.latestInteractionAt)}`}
          label="昵称记录"
          value={formatNumber(data.totals.aliases)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <OverviewTrendChart trends={data.trends} />
        <RelationshipDistribution
          items={data.relationStats}
          total={data.totals.users}
        />
      </div>

      <RankingPanel data={data} />
    </>
  );
}

export function AffinityDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showToast = false) => {
    setLoading(true);
    setError(null);
    try {
      const nextData = await send(DASHBOARD_EVENT);
      setData(nextData as DashboardData);
      if (showToast) {
        toast.success("仪表盘已刷新");
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
      if (showToast) {
        toast.error("刷新失败", {
          description: message,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="affinity-dashboard">
      <Toaster position="bottom-center" richColors />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h2 className="text-xl font-semibold leading-tight">好感度仪表盘</h2>
          <p className="text-sm text-muted-foreground">
            当前 scopeId 下的真实统计数据
          </p>
        </div>
        <Button disabled={loading} size="sm" type="button" onClick={() => void load(true)}>
          {loading ? (
            <IconLoader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <IconRefresh aria-hidden="true" />
          )}
          刷新
        </Button>
      </div>

      {loading && !data ? (
        <Card>
          <CardContent className="flex items-center gap-2 pt-4 text-sm text-muted-foreground">
            <IconLoader2 aria-hidden="true" className="animate-spin" />
            <span>正在读取仪表盘数据</span>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <IconAlertCircle aria-hidden="true" />
          <AlertTitle>仪表盘数据读取失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {data ? <DashboardContent data={data} /> : null}
    </section>
  );
}
