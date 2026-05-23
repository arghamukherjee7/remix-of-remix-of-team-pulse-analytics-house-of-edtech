import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, PhoneCall, Clock, Download } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard } from "@/components/chart-card";
import { getCurrentCycle, toISODate } from "@/lib/billing-cycle";
import { useAuth } from "@/hooks/use-auth";
import { exportToCsv } from "@/lib/export";
import { ImportDialog } from "@/components/import-dialog";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/kpi")({
  component: KpiPage,
});

function KpiPage() {
  const qc = useQueryClient();
  const { isStaff } = useAuth();
  const cycle = useMemo(() => getCurrentCycle(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    team_member_id: "", date: toISODate(new Date()), call_attempts: 0, talk_time_minutes: 0, notes: "",
  });

  const { data: members } = useQuery({
    queryKey: ["kpi-members"],
    queryFn: async () => (await supabase.from("team_members").select("id, name").eq("active", true).order("name")).data ?? [],
  });
  const { data: metrics } = useQuery({
    queryKey: ["kpi-metrics", toISODate(cycle.start), toISODate(cycle.end)],
    queryFn: async () => (await supabase.from("kpi_metrics").select("*").gte("date", toISODate(cycle.start)).lte("date", toISODate(cycle.end)).order("date", { ascending: false })).data ?? [],
  });

  const memberName = (id: string) => members?.find((m) => m.id === id)?.name ?? "—";
  const totalCalls = (metrics ?? []).reduce((s, m) => s + m.call_attempts, 0);
  const totalTalk = (metrics ?? []).reduce((s, m) => s + Number(m.talk_time_minutes), 0);
  const avgPerCall = totalCalls ? totalTalk / totalCalls : 0;

  const byDay = new Map<string, { calls: number; talk: number }>();
  (metrics ?? []).forEach((m) => {
    const c = byDay.get(m.date) ?? { calls: 0, talk: 0 };
    c.calls += m.call_attempts; c.talk += Number(m.talk_time_minutes);
    byDay.set(m.date, c);
  });
  const daily = Array.from(byDay.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([d, v]) => ({ date: format(new Date(d), "dd MMM"), ...v }));

  async function create() {
    if (!form.team_member_id) { toast.error("Select member"); return; }
    const { error } = await supabase.from("kpi_metrics").insert(form);
    if (error) { toast.error(error.message); return; }
    toast.success("KPI logged");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["kpi-metrics"] });
  }
  async function remove(id: string) {
    if (!confirm("Delete?")) return;
    await supabase.from("kpi_metrics").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["kpi-metrics"] });
  }

  async function importKpi(rows: Record<string, any>[]) {
    const byName = new Map((members ?? []).map((m) => [m.name.toLowerCase().trim(), m.id]));
    const payload: any[] = []; const errors: string[] = [];
    for (const r of rows) {
      const name = String(r["Team Member"] ?? "").toLowerCase().trim();
      const date = String(r["Date"] ?? "").trim();
      const calls = Number(r["Call Attempts"] ?? r["Total Call Attempts"] ?? 0);
      const talk = Number(r["Talk Time"] ?? r["Total Talk Time"] ?? r["Talk Time (min)"] ?? 0);
      const mid = byName.get(name);
      if (!mid || !date) { errors.push(`Skipped ${name} ${date}`); continue; }
      payload.push({ team_member_id: mid, date, call_attempts: calls, talk_time_minutes: talk });
    }
    if (payload.length) {
      const { error } = await supabase.from("kpi_metrics").insert(payload);
      if (error) throw error;
    }
    qc.invalidateQueries({ queryKey: ["kpi-metrics"] });
    return { inserted: payload.length, skipped: errors.length, errors };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">KPI Monitoring</h2>
          <p className="text-sm text-muted-foreground">{cycle.label}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCsv("kpi.csv", metrics ?? [])}><Download className="h-4 w-4 mr-1" />Export</Button>
          {isStaff && (
            <ImportDialog
              title="Import KPI Metrics"
              headers={["Team Member", "Date", "Call Attempts", "Talk Time"]}
              sample={[{ "Team Member": "Asha", "Date": "2026-05-26", "Call Attempts": 45, "Talk Time": 120 }]}
              templateFilename="kpi-template.xlsx"
              onImport={importKpi}
            />
          )}
          {isStaff && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Log KPI</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Log KPI Metric</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Team Member</Label>
                    <Select value={form.team_member_id} onValueChange={(v) => setForm({ ...form, team_member_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Call attempts</Label><Input type="number" value={form.call_attempts} onChange={(e) => setForm({ ...form, call_attempts: Number(e.target.value) })} /></div>
                    <div><Label>Talk time (min)</Label><Input type="number" step="0.1" value={form.talk_time_minutes} onChange={(e) => setForm({ ...form, talk_time_minutes: Number(e.target.value) })} /></div>
                  </div>
                  <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={create}>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Total Calls" value={totalCalls.toLocaleString()} icon={PhoneCall} />
        <KpiCard label="Total Talk Time" value={`${totalTalk.toFixed(0)}m`} icon={Clock} />
        <KpiCard label="Avg / Call" value={`${avgPerCall.toFixed(1)}m`} icon={Clock} />
      </div>

      <ChartCard title="Daily Calls & Talk Time">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} />
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
            <Legend />
            <Line type="monotone" dataKey="calls" stroke="hsl(var(--chart-1))" strokeWidth={2} />
            <Line type="monotone" dataKey="talk" stroke="hsl(var(--chart-2))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="text-left">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium text-right">Calls</th>
              <th className="px-3 py-2 font-medium text-right">Talk (min)</th>
              <th className="px-3 py-2 font-medium">Notes</th>
              <th></th>
            </tr></thead>
            <tbody>
              {(metrics ?? []).length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">No KPI entries yet.</td></tr>}
              {(metrics ?? []).map((m) => (
                <tr key={m.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">{m.date}</td>
                  <td className="px-3 py-2">{memberName(m.team_member_id)}</td>
                  <td className="px-3 py-2 text-right">{m.call_attempts}</td>
                  <td className="px-3 py-2 text-right">{Number(m.talk_time_minutes).toFixed(1)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">{m.notes}</td>
                  <td className="px-2 py-2">{isStaff && <Button variant="ghost" size="icon" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
