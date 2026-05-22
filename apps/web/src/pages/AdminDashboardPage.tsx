import { useEffect, useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { apiRequest, getAccessToken } from "@/lib/api-client";
import { useLanguage } from "@/i18n/context";
import { useCountUp } from "@/lib/use-count-up";
import { useSSE } from "@/lib/use-sse";
import { Tabs } from "@/components/ui/Tabs";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// ------- Types -------

type Stats = {
  totalUsers: number;
  verifiedUsers: number;
  totalItems: number;
  totalEstimatedValue: number;
  totalOrders: number;
  totalRevenue: number;
  activeTheftReports: number;
  newsletterSubscribers: number;
  itemsByCategory: { category: string; count: number }[];
  itemsByStatus: Record<string, number>;
};

type ChartPoint = { date: string; count: number };
type RevenuePoint = { date: string; amount: number };

type ChartData = {
  registrations: ChartPoint[];
  items: ChartPoint[];
  revenue: RevenuePoint[];
};

// Demo data for "Preview" mode — realistic growth curve over 30 days
function generatePreviewData(): { charts: ChartData; categories: { name: string; count: number }[] } {
  const points = 30;
  const registrations: ChartPoint[] = [];
  const items: ChartPoint[] = [];
  const revenue: RevenuePoint[] = [];

  for (let i = 0; i < points; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (points - 1 - i));
    const dateStr = date.toISOString().split("T")[0];
    // Growth curve with natural variation
    const base = 2 + Math.floor(i / 3);
    const jitter = () => Math.floor(Math.random() * 3) - 1;
    registrations.push({ date: dateStr, count: Math.max(0, base + jitter()) });
    items.push({ date: dateStr, count: Math.max(0, Math.floor(base * 1.8) + jitter() * 2) });
    revenue.push({ date: dateStr, amount: Math.max(0, (base * 1200 + jitter() * 500)) });
  }

  const categories = [
    { name: "velo-electrique", count: 34 },
    { name: "telephone-intelligent", count: 28 },
    { name: "ordinateur-portable", count: 22 },
    { name: "montre-luxe", count: 18 },
    { name: "drone", count: 15 },
    { name: "instrument-musique", count: 12 },
    { name: "console-jeux-video", count: 10 },
    { name: "appareil-photo", count: 8 },
    { name: "equipement-ski", count: 7 },
    { name: "bijoux", count: 5 },
  ];

  return { charts: { registrations, items, revenue }, categories };
}

const PREVIEW_DATA = generatePreviewData();

type LiveMetrics = {
  cpu: number;
  cpuCount: number;
  memTotal: number;
  memFree: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  uptime: number;
  osUptime: number;
  dbSize: number;
  dbConnections: number;
  reqPerMin: number;
};

type ActivityEntry = {
  id: string;
  type: "user" | "item" | "order" | "theft";
  date: string;
  // User fields
  firstName?: string;
  lastName?: string;
  // Item fields
  name?: string;
  // Order fields
  email?: string;
  totalAmountCents?: number;
  // Theft fields
  itemId?: string;
};

type Period = "preview" | "day" | "week" | "month";

const MONTH_ABBR_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const MONTH_ABBR_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatXAxis(dateStr: string, period: Period, locale: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  if (period === "day" || period === "preview") {
    return String(d.getUTCDate());
  }
  if (period === "week") {
    // ISO week number
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `S${weekNo}`;
  }
  // month
  const months = locale === "en" ? MONTH_ABBR_EN : MONTH_ABBR_FR;
  return months[d.getUTCMonth()] ?? "";
}

// ------- Helpers -------

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const CATEGORY_COLORS = [
  "#D80621", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
];

// ------- KPI Card -------

function KpiCard({
  label,
  value,
  icon,
  gradient,
  isCurrency = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  isCurrency?: boolean;
}) {
  const animated = useCountUp(value, 1200);
  const display = isCurrency ? formatCurrency(animated) : animated.toLocaleString();

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-white/20 p-6 shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
      style={{ background: gradient }}
    >
      {/* Glass overlay */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
      {/* Decorative circle */}
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">
            {display}
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white shadow-inner">
          {icon}
        </div>
      </div>
    </div>
  );
}

// ------- Sparkline (for server metrics) -------

function Sparkline({ data, color, dataKey }: { data: { value: number }[]; color: string; dataKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey={dataKey || "value"}
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ------- Main Page -------

export function AdminDashboardPage() {
  const { t, locale } = useLanguage();
  const admin = t.admin!;
  const d = admin.dashboard;

  const [stats, setStats] = useState<Stats | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [period, setPeriod] = useState<Period>("preview");
  const [loading, setLoading] = useState(true);

  // SSE for live metrics
  const sseUrl = useMemo(() => {
    const token = getAccessToken();
    if (!token) return null;
    return `${API_URL}/admin/metrics/live?token=${token}`;
  }, []);

  const { data: liveData, history: liveHistory } = useSSE<LiveMetrics>(sseUrl);

  // Fetch stats and activity on mount
  useEffect(() => {
    Promise.all([
      apiRequest<Stats>("/admin/stats"),
      apiRequest<{ activity: ActivityEntry[] }>("/admin/activity?limit=20"),
    ])
      .then(([statsData, activityData]) => {
        setStats(statsData);
        setActivity(activityData.activity);
      })
      .catch(() => {
        // Silently fail — the page will show 0s
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch charts when period changes (skip API for preview mode)
  useEffect(() => {
    if (period === "preview") return;
    apiRequest<ChartData>(`/admin/stats/charts?period=${period}`)
      .then(setCharts)
      .catch(() => { /* charts fetch failed silently */ });
  }, [period]);

  // Use preview data or real data depending on period
  const activeCharts = period === "preview" ? PREVIEW_DATA.charts : charts;

  // Sparkline data from SSE history
  const cpuHistory = liveHistory.map((m) => ({ value: m.cpu }));
  const ramHistory = liveHistory.map((m) => ({
    value: m.memTotal ? Math.round(((m.memTotal - m.memFree) / m.memTotal) * 100) : 0,
  }));

  // Items by category for pie chart (top 8 + "Other")
  const categoryData = useMemo(() => {
    const raw = period === "preview"
      ? PREVIEW_DATA.categories
      : stats
        ? stats.itemsByCategory
            .map((c) => ({ name: c.category, count: c.count }))
            .sort((a, b) => b.count - a.count)
        : [];
    if (raw.length <= 8) return raw;
    const top8 = raw.slice(0, 8);
    const othersCount = raw.slice(8).reduce((sum, c) => sum + c.count, 0);
    return [...top8, { name: "Other", count: othersCount }];
  }, [period, stats]);

  const heapPercent = liveData?.heapTotal
    ? Math.round((liveData.heapUsed / liveData.heapTotal) * 100)
    : 0;

  const xAxisLabel = period === "week"
    ? (d.axisWeekNumber ?? "Week")
    : period === "month"
      ? (d.axisMonth ?? "Month")
      : (d.axisDayOfMonth ?? "Day of month");

  const periodTabs = [
    { key: "preview" as Period, label: d.periodPreview ?? "Preview" },
    { key: "day" as Period, label: d.periodDay },
    { key: "week" as Period, label: d.periodWeek },
    { key: "month" as Period, label: d.periodMonth },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-[var(--rcb-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <title>{`Admin — ${d.title} | Badge`}</title>
      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--rcb-text-strong)] lg:text-3xl">
          {d.title}
        </h1>
      </div>

      {/* ===== KPI Cards ===== */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        <KpiCard
          label={d.totalUsers}
          value={stats?.totalUsers ?? 0}
          gradient="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
          icon={
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          }
        />
        <KpiCard
          label={d.totalItems}
          value={stats?.totalItems ?? 0}
          gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
          icon={
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          }
        />
        <KpiCard
          label={d.ordersCompleted}
          value={stats?.totalOrders ?? 0}
          gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
          icon={
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
            </svg>
          }
        />
        <KpiCard
          label={d.revenue}
          value={stats?.totalRevenue ?? 0}
          isCurrency
          gradient="linear-gradient(135deg, #D80621 0%, #9f1239 100%)"
          icon={
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          }
        />
      </div>

      {/* ===== Charts Section ===== */}
      <div className="mt-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-[var(--rcb-text-strong)]">
            {d.chartsTitle}
          </h2>
          <Tabs
            tabs={periodTabs}
            activeTab={period}
            onChange={setPeriod}
            tabMinWidth={90}
          >
            <></>
          </Tabs>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Registrations chart */}
          <ChartCard title={d.registrations} color="#3b82f6" gradientId="regGrad">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={activeCharts?.registrations ?? []} margin={{ bottom: 20, left: 10 }}>
                <defs>
                  <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatXAxis(v, period, locale)} interval={period === "day" || period === "preview" ? 4 : undefined} label={{ value: xAxisLabel, position: "bottom", offset: 2, style: { fontSize: 10, fill: "#aaa" } }} />
                <YAxis tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} width={45} label={{ value: d.axisCount ?? "Count", angle: -90, position: "insideLeft", offset: -2, style: { fontSize: 10, fill: "#aaa" } }} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#fff", fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#regGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Items chart */}
          <ChartCard title={d.itemsRegistered} color="#10b981" gradientId="itemGrad">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={activeCharts?.items ?? []} margin={{ bottom: 20, left: 10 }}>
                <defs>
                  <linearGradient id="itemGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatXAxis(v, period, locale)} interval={period === "day" || period === "preview" ? 4 : undefined} label={{ value: xAxisLabel, position: "bottom", offset: 2, style: { fontSize: 10, fill: "#aaa" } }} />
                <YAxis tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} width={45} label={{ value: d.axisCount ?? "Count", angle: -90, position: "insideLeft", offset: -2, style: { fontSize: 10, fill: "#aaa" } }} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#fff", fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fill="url(#itemGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Revenue chart */}
          <ChartCard title={d.revenueOverTime} color="#D80621" gradientId="revGrad">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={activeCharts?.revenue ?? []} margin={{ bottom: 20, left: 10 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D80621" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#D80621" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatXAxis(v, period, locale)} interval={period === "day" || period === "preview" ? 4 : undefined} label={{ value: xAxisLabel, position: "bottom", offset: 2, style: { fontSize: 10, fill: "#aaa" } }} />
                <YAxis tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} width={55} label={{ value: d.axisRevenue ?? "$ CAD", angle: -90, position: "insideLeft", offset: -2, style: { fontSize: 10, fill: "#aaa" } }} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#fff", fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(value) => [formatCurrency(Number(value) || 0), ""]}
                />
                <Area type="monotone" dataKey="amount" stroke="#D80621" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Items by category */}
          <ChartCard title={d.itemsByCategory} color="#8b5cf6" gradientId="catGrad">
            <div className="flex flex-col items-center gap-2 lg:flex-row">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={50}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#fff", fontSize: 12 }}
                    formatter={(value, name) => [String(value), String(name)]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex w-full flex-col gap-1.5 px-2 lg:w-auto lg:min-w-[160px]">
                {categoryData.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    <span className="truncate text-[var(--rcb-text-muted)]">{c.name}</span>
                    <span className="ml-auto font-semibold text-[var(--rcb-text-strong)]">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* ===== Live Server Metrics ===== */}
      <div className="mt-10 overflow-hidden rounded-2xl bg-[#0f172a] p-6 shadow-xl lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">{d.serverMetrics}</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {d.live}
          </span>
        </div>

        {!liveData || !liveData.cpu ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            <span className="ml-3 text-sm text-white/50">Connecting...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Row 1: CPU, RAM, Node Heap with sparklines */}
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricPanel label={d.cpu} value={`${liveData.cpu.toFixed(1)}%`} color="#3b82f6">
                <Sparkline data={cpuHistory} color="#3b82f6" />
              </MetricPanel>

              <MetricPanel
                label={d.ram}
                value={`${liveData.memTotal ? Math.round(((liveData.memTotal - liveData.memFree) / liveData.memTotal) * 100) : 0}%`}
                color="#8b5cf6"
              >
                <Sparkline data={ramHistory} color="#8b5cf6" />
              </MetricPanel>

              <MetricPanel label={d.nodeHeap} value={`${heapPercent}%`} color="#f59e0b">
                <div className="mt-2">
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${heapPercent}%`,
                        background: `linear-gradient(90deg, #f59e0b, ${heapPercent > 80 ? "#ef4444" : "#f59e0b"})`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-white/30">
                    {liveData.heapUsed ? `${(liveData.heapUsed / 1024 / 1024).toFixed(0)}MB / ${(liveData.heapTotal / 1024 / 1024).toFixed(0)}MB` : "—"}
                  </p>
                </div>
              </MetricPanel>
            </div>

            {/* Row 2: DB size, Connections, Req/min, Uptime */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MiniMetric label={d.dbSize} value={liveData.dbSize ? `${(liveData.dbSize / 1024 / 1024).toFixed(1)} MB` : "—"} />
              <MiniMetric label={d.connections} value={String(liveData.dbConnections ?? 0)} />
              <MiniMetric label={d.reqPerMin} value={String(liveData.reqPerMin ?? 0)} />
              <MiniMetric label={d.uptime} value={formatUptime(liveData.uptime)} />
            </div>
          </div>
        )}
      </div>

      {/* ===== Activity Feed ===== */}
      <div className="mt-10">
        <h2 className="mb-4 text-xl font-bold text-[var(--rcb-text-strong)]">
          {d.activityFeed}
        </h2>
        <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-[var(--rcb-border)] bg-white shadow-sm">
          {activity.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--rcb-text-muted)]">
              {d.noActivity}
            </div>
          ) : (
            <div className="divide-y divide-[var(--rcb-border)]">
              {activity.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ------- Sub-components -------

function ChartCard({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  gradientId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--rcb-border)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <h3 className="text-sm font-semibold text-[var(--rcb-text-strong)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MetricPanel({
  label,
  value,
  color,
  children,
}: {
  label: string;
  value: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/5 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-white/40">{label}</span>
        <span className="text-lg font-bold" style={{ color }}>{value}</span>
      </div>
      {children}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/5 p-3 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 text-base font-bold text-white">{value}</p>
    </div>
  );
}

const activityTypeConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  user: {
    color: "#3b82f6",
    label: "Registration",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4-4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  item: {
    color: "#10b981",
    label: "Item registered",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      </svg>
    ),
  },
  order: {
    color: "#f59e0b",
    label: "Order",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
      </svg>
    ),
  },
  theft: {
    color: "#ef4444",
    label: "Theft report",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
};

function activityDescription(entry: ActivityEntry): string {
  switch (entry.type) {
    case "user":
      return `${entry.firstName ?? ""} ${entry.lastName ?? ""}`.trim() || "New user";
    case "item":
      return entry.name ?? "New item";
    case "order":
      return `${entry.email ?? "Order"} — ${((entry.totalAmountCents ?? 0) / 100).toFixed(2)} $`;
    case "theft":
      return `Theft report #${(entry.id ?? "").slice(0, 8)}`;
    default:
      return "Activity";
  }
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const config = activityTypeConfig[entry.type] ?? activityTypeConfig.item;
  const exactDate = new Date(entry.date).toLocaleString();

  return (
    <div
      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--rcb-surface)]"
      title={exactDate}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: config.color }}
      >
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm text-[var(--rcb-text-strong)]">{activityDescription(entry)}</p>
        <p className="text-xs text-[var(--rcb-text-muted)]">{config.label}</p>
      </div>
      <span className="shrink-0 text-xs text-[var(--rcb-text-muted)]">
        {relativeTime(entry.date)}
      </span>
    </div>
  );
}
export default AdminDashboardPage;
