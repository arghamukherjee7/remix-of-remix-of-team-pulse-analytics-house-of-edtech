import { createFileRoute } from "@tanstack/react-router";
import { formatINR } from "@/lib/currency";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ChartCard } from "@/components/chart-card";
import { KpiCard } from "@/components/kpi-card";
import { Award, TrendingUp, Users } from "lucide-react";
import { getCurrentCycle, toISODate } from "@/lib/billing-cycle";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { useUnifiedRevenue } from "@/lib/revenue-source";

export const Route = createFileRoute("/_authenticated/team-performance")({
  component: TeamPerfPage,
});

function TeamPerfPage() {
  const cycle = useMemo(() => getCurrentCycle(), []);
  const startISO = toISODate(cycle.start);
  const endISO = toISODate(cycle.end);

  const { data: members } = useQuery({ queryKey: ["tp-members"], queryFn: async () => (await supabase.from("team_members").select("id, name, team_group").eq("active", true)).data ?? [] });
  const unified = useUnifiedRevenue(startISO, endISO);
  const revenue = unified.entries;
  const leads = unified.leads;
  const { data: kpi } = useQuery({ queryKey: ["tp-kpi", startISO, endISO], queryFn: async () => (await supabase.from("kpi_metrics").select("team_member_id, call_attempts, talk_time_minutes").gte("date", startISO).lte("date", endISO)).data ?? [] });
  const { data: att } = useQuery({ queryKey: ["tp-att", startISO, endISO], queryFn: async () => (await supabase.from("attendance").select("team_member_id, status").gte("date", startISO).lte("date", endISO)).data ?? [] });

  const perf = (members ?? []).map((m) => {
    const mRev = revenue.filter((r) => r.team_member_id === m.id).reduce((s, r) => s + Number(r.amount), 0);
    const mLeadRows = leads.filter((l) => l.team_member_id === m.id);
    const mLeadCount = mLeadRows.reduce((s, l) => s + Number(l.leads_count ?? 1), 0);
    const converted = mLeadRows.filter((l) => l.status === "converted").length;
    const calls = (kpi ?? []).filter((k) => k.team_member_id === m.id).reduce((s, k) => s + k.call_attempts, 0);
    const talk = (kpi ?? []).filter((k) => k.team_member_id === m.id).reduce((s, k) => s + Number(k.talk_time_minutes), 0);
    const att_records = (att ?? []).filter((a) => a.team_member_id === m.id);
    const present = att_records.filter((a) => a.status === "present").length;
    const attPct = att_records.length ? (present / att_records.length) * 100 : 0;
    return {
      id: m.id, name: m.name, team_group: m.team_group,
      revenue: mRev, leads: mLeadCount, converted,
      conversion: mLeadCount ? (converted / mLeadCount) * 100 : 0,
      arpu: mLeadCount ? mRev / mLeadCount : 0, calls, talk, attPct,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const top = perf[0];
  const teamRevenue = perf.reduce((s, p) => s + p.revenue, 0);
  const teamLeads = perf.reduce((s, p) => s + p.leads, 0);

  const radarData = perf.slice(0, 5).map((p) => {
    const maxRev = Math.max(...perf.map((x) => x.revenue), 1);
    const maxCalls = Math.max(...perf.map((x) => x.calls), 1);
    return {
      name: p.name,
      Revenue: (p.revenue / maxRev) * 100,
      Conversion: p.conversion,
      Attendance: p.attPct,
      Calls: (p.calls / maxCalls) * 100,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Team Performance</h2>
        <p className="text-sm text-muted-foreground">{cycle.label}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Top Performer" value={top?.name ?? "—"} hint={top ? `${formatINR(top.revenue)}` : ""} icon={Award} />
        <KpiCard label="Team Revenue" value={`${formatINR(teamRevenue)}`} icon={TrendingUp} />
        <KpiCard label="Team Leads" value={teamLeads} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Revenue by Member">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perf}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top 5 Multi-Metric Comparison">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={[
              { metric: "Revenue", ...Object.fromEntries(radarData.map((r) => [r.name, r.Revenue])) },
              { metric: "Conversion", ...Object.fromEntries(radarData.map((r) => [r.name, r.Conversion])) },
              { metric: "Attendance", ...Object.fromEntries(radarData.map((r) => [r.name, r.Attendance])) },
              { metric: "Calls", ...Object.fromEntries(radarData.map((r) => [r.name, r.Calls])) },
            ]}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" fontSize={11} />
              <PolarRadiusAxis fontSize={10} />
              {radarData.map((r, i) => (
                <Radar key={r.name} name={r.name} dataKey={r.name} stroke={`hsl(var(--chart-${(i % 5) + 1}))`} fill={`hsl(var(--chart-${(i % 5) + 1}))`} fillOpacity={0.2} />
              ))}
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b px-4 py-3"><h3 className="text-sm font-semibold">Performance Leaderboard</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="text-left">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Group</th>
              <th className="px-3 py-2 font-medium text-right">Revenue</th>
              <th className="px-3 py-2 font-medium text-right">Leads</th>
              <th className="px-3 py-2 font-medium text-right">Conv %</th>
              <th className="px-3 py-2 font-medium text-right">ARPU</th>
              <th className="px-3 py-2 font-medium text-right">Calls</th>
              <th className="px-3 py-2 font-medium text-right">Att %</th>
            </tr></thead>
            <tbody>
              {perf.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-xs text-muted-foreground">No team activity yet.</td></tr>}
              {perf.map((p, i) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2"><Badge variant={i === 0 ? "default" : "secondary"}>{i + 1}</Badge></td>
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.team_group ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatINR(p.revenue)}</td>
                  <td className="px-3 py-2 text-right">{p.leads}</td>
                  <td className="px-3 py-2 text-right">{p.conversion.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right">{formatINR(p.arpu)}</td>
                  <td className="px-3 py-2 text-right">{p.calls}</td>
                  <td className="px-3 py-2 text-right">{p.attPct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
