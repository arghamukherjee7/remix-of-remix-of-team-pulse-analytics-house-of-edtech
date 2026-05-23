import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard } from "@/components/chart-card";
import { getCurrentCycle, toISODate, getWeeksInCycle } from "@/lib/billing-cycle";
import { useMemo } from "react";
import {
  DollarSign, Users, UserPlus, Target, PhoneCall, Clock,
  TrendingUp, Award, AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { formatINR } from "@/lib/currency";
import { format } from "date-fns";
import { useUnifiedRevenue, totalLeadsCount } from "@/lib/revenue-source";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

function Dashboard() {
  const cycle = useMemo(() => getCurrentCycle(), []);
  const startISO = toISODate(cycle.start);
  const endISO = toISODate(cycle.end);

  const unified = useUnifiedRevenue(startISO, endISO);
  const revenue = unified.entries;
  const leads = unified.leads;

  const { data: attendance } = useQuery({
    queryKey: ["dashboard-attendance", startISO, endISO],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("date, status, team_member_id")
        .gte("date", startISO).lte("date", endISO);
      return data ?? [];
    },
  });

  const { data: kpi } = useQuery({
    queryKey: ["dashboard-kpi", startISO, endISO],
    queryFn: async () => {
      const { data } = await supabase
        .from("kpi_metrics")
        .select("date, call_attempts, talk_time_minutes, team_member_id")
        .gte("date", startISO).lte("date", endISO);
      return data ?? [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["dashboard-members"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("id, name").eq("active", true);
      return data ?? [];
    },
  });

  const totalRevenue = revenue.reduce((s, r) => s + Number(r.amount), 0);
  const totalLeads = totalLeadsCount(leads);
  const totalCalls = (kpi ?? []).reduce((s, r) => s + r.call_attempts, 0);
  const totalTalkTime = (kpi ?? []).reduce((s, r) => s + Number(r.talk_time_minutes), 0);
  const arpu = totalLeads ? totalRevenue / totalLeads : 0;

  const present = (attendance ?? []).filter((a) => a.status === "present").length;
  const attendancePct = attendance && attendance.length ? Math.round((present / attendance.length) * 100) : 0;

  // Weekly revenue series
  const weeks = useMemo(() => getWeeksInCycle(cycle), [cycle]);
  const weeklyRevenue = weeks.map((w) => {
    const sum = (revenue ?? []).filter((r) => {
      const d = new Date(r.date);
      return d >= w.start && d <= w.end;
    }).reduce((s, r) => s + Number(r.amount), 0);
    return { week: format(w.start, "dd MMM"), revenue: sum };
  });

  // Daily revenue trend
  const byDay = new Map<string, number>();
  (revenue ?? []).forEach((r) => byDay.set(r.date, (byDay.get(r.date) ?? 0) + Number(r.amount)));
  const dailyRevenue = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date: format(new Date(date), "dd MMM"), revenue: value }));

  // Team performance
  const memberMap = new Map(members?.map((m) => [m.id, m.name]) ?? []);
  const perMember = new Map<string, { revenue: number; leads: number; calls: number }>();
  (revenue ?? []).forEach((r) => {
    if (!r.team_member_id) return;
    const cur = perMember.get(r.team_member_id) ?? { revenue: 0, leads: 0, calls: 0 };
    cur.revenue += Number(r.amount);
    perMember.set(r.team_member_id, cur);
  });
  leads.forEach((l) => {
    if (!l.team_member_id) return;
    const cur = perMember.get(l.team_member_id) ?? { revenue: 0, leads: 0, calls: 0 };
    cur.leads += Number(l.leads_count ?? 1);
    perMember.set(l.team_member_id, cur);
  });
  (kpi ?? []).forEach((k) => {
    const cur = perMember.get(k.team_member_id) ?? { revenue: 0, leads: 0, calls: 0 };
    cur.calls += k.call_attempts;
    perMember.set(k.team_member_id, cur);
  });
  const teamPerf = Array.from(perMember.entries()).map(([id, v]) => ({
    name: memberMap.get(id) ?? "Unknown",
    ...v,
  })).sort((a, b) => b.revenue - a.revenue);

  const best = teamPerf[0];
  const worst = teamPerf[teamPerf.length - 1];

  return (
    <div className="space-y-6">
      {/* Cycle banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Active Billing Cycle</p>
          <p className="text-lg font-semibold text-foreground">{cycle.label}</p>
        </div>
        <div className="text-xs text-muted-foreground">
          26th-to-25th cycle · {members?.length ?? 0} active members
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Total Revenue" value={`${formatINR(totalRevenue)}`} icon={DollarSign} />
        <KpiCard label="Total Leads" value={totalLeads} icon={UserPlus} />
        <KpiCard label="ARPU" value={`${formatINR(arpu)}`} hint="Revenue ÷ Leads" icon={Target} />
        <KpiCard label="Attendance %" value={`${attendancePct}%`} icon={Users} />
        <KpiCard label="Call Attempts" value={totalCalls.toLocaleString()} icon={PhoneCall} />
        <KpiCard label="Talk Time" value={`${totalTalkTime.toFixed(0)}m`} icon={Clock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Best Performer"
          value={best?.name ?? "—"}
          hint={best ? `${formatINR(best.revenue)} revenue` : "No data yet"}
          icon={Award}
          trend="up"
        />
        <KpiCard
          label="Needs Attention"
          value={worst && worst !== best ? worst.name : "—"}
          hint={worst && worst !== best ? `${formatINR(worst.revenue)} revenue` : "No data yet"}
          icon={AlertTriangle}
          trend="down"
        />
        <KpiCard
          label="Revenue per Lead"
          value={`${formatINR(arpu)}`}
          hint="Live calculation"
          icon={TrendingUp}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Daily Revenue Trend" description="Revenue across the current billing cycle">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyRevenue}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" fill="url(#g1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Weekly Comparison" description="Revenue by week of cycle">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyRevenue}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="week" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Team Performance" description="Revenue vs leads by team member">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={teamPerf.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="leads" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Call Attempts vs Talk Time" description="Daily KPI trends">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={
              (() => {
                const m = new Map<string, { calls: number; talk: number }>();
                (kpi ?? []).forEach((k) => {
                  const cur = m.get(k.date) ?? { calls: 0, talk: 0 };
                  cur.calls += k.call_attempts;
                  cur.talk += Number(k.talk_time_minutes);
                  m.set(k.date, cur);
                });
                return Array.from(m.entries()).sort(([a],[b]) => a.localeCompare(b))
                  .map(([d, v]) => ({ date: format(new Date(d), "dd MMM"), ...v }));
              })()
            }>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Line type="monotone" dataKey="calls" stroke="hsl(var(--chart-1))" strokeWidth={2} />
              <Line type="monotone" dataKey="talk" stroke="hsl(var(--chart-2))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Team summary table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Team Summary — Current Cycle</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Member</th>
                <th className="px-4 py-2 font-medium text-right">Revenue</th>
                <th className="px-4 py-2 font-medium text-right">Leads</th>
                <th className="px-4 py-2 font-medium text-right">ARPU</th>
                <th className="px-4 py-2 font-medium text-right">Calls</th>
              </tr>
            </thead>
            <tbody>
              {teamPerf.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">
                  No activity yet — add team members and record data to see analytics.
                </td></tr>
              )}
              {teamPerf.map((m, i) => (
                <tr key={i} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{m.name}</td>
                  <td className="px-4 py-2 text-right">{formatINR(m.revenue)}</td>
                  <td className="px-4 py-2 text-right">{m.leads}</td>
                  <td className="px-4 py-2 text-right">{m.leads ? formatINR(m.revenue / m.leads) : formatINR(0)}</td>
                  <td className="px-4 py-2 text-right">{m.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
