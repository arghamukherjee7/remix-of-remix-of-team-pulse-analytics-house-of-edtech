import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Download } from "lucide-react";
import { ChartCard } from "@/components/chart-card";
import { KpiCard } from "@/components/kpi-card";
import { ImportDialog } from "@/components/import-dialog";
import { getCurrentCycle, toISODate, getWeeksInCycle } from "@/lib/billing-cycle";
import { useAuth } from "@/hooks/use-auth";
import { exportToCsv } from "@/lib/export";
import { DollarSign, TrendingUp, Users } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from "recharts";
import { formatINR } from "@/lib/currency";
import { format } from "date-fns";
import { useUnifiedRevenue } from "@/lib/revenue-source";

export const Route = createFileRoute("/_authenticated/revenue")({
  component: RevenuePage,
});

function RevenuePage() {
  const qc = useQueryClient();
  const { isStaff } = useAuth();
  const cycle = useMemo(() => getCurrentCycle(), []);
  const startISO = toISODate(cycle.start);
  const endISO = toISODate(cycle.end);
  const [open, setOpen] = useState(false);
  const [filterMember, setFilterMember] = useState("all");
  const [filterSource, setFilterSource] = useState<"all" | "revenue_entry" | "lead">("all");
  const [form, setForm] = useState({
    date: toISODate(new Date()), amount: 0, team_member_id: "", batch_id: "", notes: "",
  });

  const { data: members } = useQuery({
    queryKey: ["rev-members"],
    queryFn: async () => (await supabase.from("team_members").select("id, name").eq("active", true).order("name")).data ?? [],
  });
  const { data: batches } = useQuery({
    queryKey: ["rev-batches"],
    queryFn: async () => (await supabase.from("batches").select("id, name").order("name")).data ?? [],
  });

  const unified = useUnifiedRevenue(startISO, endISO);
  const entries = unified.entries;

  const memberName = (id: string | null) => members?.find((m) => m.id === id)?.name ?? "—";
  const batchName = (id: string | null) => batches?.find((b) => b.id === id)?.name ?? "—";
  const filtered = entries
    .filter((e) => filterMember === "all" || e.team_member_id === filterMember)
    .filter((e) => filterSource === "all" || e.source === filterSource)
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);
  const avgDaily = filtered.length ? total / new Set(filtered.map((r) => r.date)).size : 0;
  const uniqueMembers = new Set(filtered.map((r) => r.team_member_id).filter(Boolean)).size;
  const fromLeads = filtered.filter((e) => e.source === "lead").reduce((s, r) => s + r.amount, 0);

  const weeks = useMemo(() => getWeeksInCycle(cycle), [cycle]);
  const weeklyData = weeks.map((w) => ({
    week: format(w.start, "dd MMM"),
    revenue: filtered.filter((r) => { const d = new Date(r.date); return d >= w.start && d <= w.end; }).reduce((s, r) => s + Number(r.amount), 0),
  }));
  const byDay = new Map<string, number>();
  filtered.forEach((r) => byDay.set(r.date, (byDay.get(r.date) ?? 0) + Number(r.amount)));
  const dailyData = Array.from(byDay.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([d, v]) => ({ date: format(new Date(d), "dd MMM"), revenue: v }));

  async function create() {
    if (form.amount <= 0) { toast.error("Amount must be positive"); return; }
    const { error } = await supabase.from("revenue_entries").insert({
      ...form, team_member_id: form.team_member_id || null, batch_id: form.batch_id || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Revenue added");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["uni-rev-entries"] });
  }

  async function remove(id: string, source: string) {
    if (source !== "revenue_entry") {
      toast.error("Lead-sourced revenue must be edited in the Lead Assignment tab");
      return;
    }
    if (!confirm("Delete this entry?")) return;
    const { error } = await supabase.from("revenue_entries").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["uni-rev-entries"] });
  }

  async function importRevenue(rows: Record<string, any>[]) {
    const byName = new Map((members ?? []).map((m) => [m.name.toLowerCase().trim(), m.id]));
    const payload: any[] = []; const errors: string[] = [];
    for (const r of rows) {
      const name = String(r["Team Member"] ?? "").toLowerCase().trim();
      const date = String(r["Date"] ?? "").trim();
      const amount = Number(r["Amount"] ?? r["Revenue"] ?? 0);
      const notes = String(r["Notes"] ?? "") || null;
      const mid = byName.get(name);
      if (!date || amount <= 0) { errors.push(`Row skipped: ${name} ${date}`); continue; }
      payload.push({ team_member_id: mid ?? null, date, amount, notes });
    }
    if (payload.length) {
      const { error } = await supabase.from("revenue_entries").insert(payload);
      if (error) throw error;
    }
    qc.invalidateQueries({ queryKey: ["uni-rev-entries"] });
    return { inserted: payload.length, skipped: errors.length, errors };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Revenue Tracking</h2>
          <p className="text-sm text-muted-foreground">{cycle.label} · synced with Lead Assignment</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportToCsv("revenue.csv", filtered)}><Download className="h-4 w-4 mr-1" />Export</Button>
          {isStaff && (
            <ImportDialog
              title="Import Revenue Entries"
              headers={["Team Member", "Date", "Amount", "Notes"]}
              sample={[{ "Team Member": "Asha", "Date": "2026-05-26", "Amount": 25000, "Notes": "Cycle opening" }]}
              templateFilename="revenue-template.xlsx"
              onImport={importRevenue}
            />
          )}
          {isStaff && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Revenue</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Revenue Entry</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                    <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                  </div>
                  <div>
                    <Label>Team Member</Label>
                    <Select value={form.team_member_id} onValueChange={(v) => setForm({ ...form, team_member_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Batch</Label>
                    <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{batches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={create}>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard label="Total Revenue" value={`${formatINR(total)}`} icon={DollarSign} hint="All sources" />
        <KpiCard label="From Lead Assignments" value={`${formatINR(fromLeads)}`} icon={TrendingUp} />
        <KpiCard label="Avg Daily" value={`${formatINR(avgDaily)}`} icon={TrendingUp} />
        <KpiCard label="Contributors" value={uniqueMembers} icon={Users} />
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-3">
        <Label className="text-xs">Member:</Label>
        <Select value={filterMember} onValueChange={setFilterMember}>
          <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            {members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Label className="text-xs">Source:</Label>
        <Select value={filterSource} onValueChange={(v) => setFilterSource(v as any)}>
          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="revenue_entry">Manual / Imported</SelectItem>
            <SelectItem value="lead">Lead Assignment</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Daily Revenue">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData}>
              <defs><linearGradient id="rv1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" fill="url(#rv1)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Weekly Revenue">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="week" fontSize={11} /><YAxis fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="text-left">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Batch</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
              <th className="px-3 py-2 font-medium">Notes</th>
              <th></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">No revenue entries yet.</td></tr>}
              {filtered.map((e) => (
                <tr key={`${e.source}-${e.id}`} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">{e.date}</td>
                  <td className="px-3 py-2">{memberName(e.team_member_id)}</td>
                  <td className="px-3 py-2">{batchName(e.batch_id)}</td>
                  <td className="px-3 py-2"><Badge variant={e.source === "lead" ? "secondary" : "default"} className="text-[10px]">{e.source === "lead" ? "Lead" : "Manual"}</Badge></td>
                  <td className="px-3 py-2 text-right font-medium">{formatINR(e.amount)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">{e.notes}</td>
                  <td className="px-2 py-2">{isStaff && e.source === "revenue_entry" && <Button variant="ghost" size="icon" onClick={() => remove(e.id, e.source)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
