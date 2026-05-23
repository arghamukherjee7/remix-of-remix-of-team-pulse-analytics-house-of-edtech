import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileBarChart } from "lucide-react";
import { getCurrentCycle, previousCycle, nextCycle, toISODate, type CycleRange } from "@/lib/billing-cycle";
import { exportToCsv } from "@/lib/export";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUnifiedRevenue, totalLeadsCount } from "@/lib/revenue-source";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const [cycle, setCycle] = useState<CycleRange>(() => getCurrentCycle());
  const startISO = toISODate(cycle.start);
  const endISO = toISODate(cycle.end);

  const { data: members } = useQuery({ queryKey: ["rep-members"], queryFn: async () => (await supabase.from("team_members").select("id, name").order("name")).data ?? [] });
  const unified = useUnifiedRevenue(startISO, endISO);
  const revenue = unified.entries;
  const leads = unified.leads;
  const { data: attendance } = useQuery({ queryKey: ["rep-att", startISO, endISO], queryFn: async () => (await supabase.from("attendance").select("*").gte("date", startISO).lte("date", endISO)).data ?? [] });
  const { data: kpi } = useQuery({ queryKey: ["rep-kpi", startISO, endISO], queryFn: async () => (await supabase.from("kpi_metrics").select("*").gte("date", startISO).lte("date", endISO)).data ?? [] });

  const memberName = (id: string | null) => members?.find((m) => m.id === id)?.name ?? "—";

  const summary = useMemo(() => {
    return (members ?? []).map((m) => {
      const rev = revenue.filter((r) => r.team_member_id === m.id).reduce((s, r) => s + Number(r.amount), 0);
      const lds = leads.filter((l) => l.team_member_id === m.id);
      const ldCount = totalLeadsCount(lds);
      const conv = lds.filter((l) => l.status === "converted").length;
      const calls = (kpi ?? []).filter((k) => k.team_member_id === m.id).reduce((s, k) => s + k.call_attempts, 0);
      const att = (attendance ?? []).filter((a) => a.team_member_id === m.id);
      const present = att.filter((a) => a.status === "present").length;
      return {
        member: m.name, revenue: rev, leads: ldCount, converted: conv,
        conversion_pct: ldCount ? Number(((conv / ldCount) * 100).toFixed(1)) : 0,
        arpu: ldCount ? Math.round(rev / ldCount) : 0,
        calls, attendance_pct: att.length ? Math.round((present / att.length) * 100) : 0,
      };
    });
  }, [members, revenue, leads, attendance, kpi]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Reports Center</h2>
          <p className="text-sm text-muted-foreground">{cycle.label}</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" size="sm" onClick={() => setCycle(previousCycle(cycle))}>← Prev</Button>
          <Button variant="outline" size="sm" onClick={() => setCycle(getCurrentCycle())}>Current</Button>
          <Button variant="outline" size="sm" onClick={() => setCycle(nextCycle(cycle))}>Next →</Button>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Team Summary</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="kpi">KPI</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <ReportTable
            title="Team Summary Report"
            filename={`team-summary-${startISO}.csv`}
            rows={summary}
            columns={["member","revenue","leads","converted","conversion_pct","arpu","calls","attendance_pct"]}
          />
        </TabsContent>
        <TabsContent value="revenue">
          <ReportTable
            title="Revenue Entries"
            filename={`revenue-${startISO}.csv`}
            rows={(revenue ?? []).map((r) => ({ date: r.date, member: memberName(r.team_member_id), amount: Number(r.amount), notes: r.notes ?? "" }))}
            columns={["date","member","amount","notes"]}
          />
        </TabsContent>
        <TabsContent value="leads">
          <ReportTable
            title="Leads Report"
            filename={`leads-${startISO}.csv`}
            rows={leads.map((l) => ({ date: l.assigned_date, member: memberName(l.team_member_id), status: l.status, leads: Number(l.leads_count ?? 1), revenue: Number(l.revenue_generated) }))}
            columns={["date","member","status","leads","revenue"]}
          />
        </TabsContent>
        <TabsContent value="attendance">
          <ReportTable
            title="Attendance Report"
            filename={`attendance-${startISO}.csv`}
            rows={(attendance ?? []).map((a) => ({ date: a.date, member: memberName(a.team_member_id), status: a.status }))}
            columns={["date","member","status"]}
          />
        </TabsContent>
        <TabsContent value="kpi">
          <ReportTable
            title="KPI Report"
            filename={`kpi-${startISO}.csv`}
            rows={(kpi ?? []).map((k) => ({ date: k.date, member: memberName(k.team_member_id), call_attempts: k.call_attempts, talk_time: Number(k.talk_time_minutes) }))}
            columns={["date","member","call_attempts","talk_time"]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportTable({ title, rows, columns, filename }: { title: string; rows: Record<string, unknown>[]; columns: string[]; filename: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><FileBarChart className="h-4 w-4" />{title}</h3>
        <Button variant="outline" size="sm" onClick={() => exportToCsv(filename, rows)}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
      </div>
      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0"><tr className="text-left">
            {columns.map((c) => <th key={c} className="px-3 py-2 font-medium capitalize">{c.replace(/_/g, " ")}</th>)}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-xs text-muted-foreground">No data in this cycle.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="border-t hover:bg-muted/30">
                {columns.map((c) => <td key={c} className="px-3 py-2">{String(r[c] ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
