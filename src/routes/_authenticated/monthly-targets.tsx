import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Pencil } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { ChartCard } from "@/components/chart-card";
import { getCurrentCycle } from "@/lib/billing-cycle";
import { useAuth } from "@/hooks/use-auth";
import { formatINR } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/monthly-targets")({
  component: MonthlyTargetsPage,
});

type MT = {
  id: string; team_member_id: string; billing_cycle_id: string | null;
  revenue_target: number; leads_target: number; notes: string | null;
};

function MonthlyTargetsPage() {
  const qc = useQueryClient();
  const { isStaff } = useAuth();
  const currentCycle = useMemo(() => getCurrentCycle(), []);
  const [open, setOpen] = useState(false);
  const [filterMember, setFilterMember] = useState("all");
  const [filterCycle, setFilterCycle] = useState<string>("active");
  const [form, setForm] = useState({
    id: "" as string, team_member_id: "", billing_cycle_id: "",
    revenue_target: 0, leads_target: 0, notes: "",
  });

  const { data: members } = useQuery({
    queryKey: ["mt-members"],
    queryFn: async () => (await supabase.from("team_members").select("id, name").eq("active", true).order("name")).data ?? [],
  });
  const { data: cycles } = useQuery({
    queryKey: ["mt-cycles"],
    queryFn: async () => (await supabase.from("billing_cycles").select("*").order("start_date", { ascending: false })).data ?? [],
  });
  const { data: targets } = useQuery({
    queryKey: ["monthly-targets"],
    queryFn: async () => (await supabase.from("monthly_targets").select("*").order("created_at", { ascending: false })).data ?? [] as MT[],
  });
  const { data: leadsData } = useQuery({
    queryKey: ["mt-leads"],
    queryFn: async () => (await supabase.from("leads").select("team_member_id, assigned_date, leads_count, revenue_generated")).data ?? [],
  });
  const { data: revenueData } = useQuery({
    queryKey: ["mt-rev"],
    queryFn: async () => (await supabase.from("revenue_entries").select("team_member_id, date, amount")).data ?? [],
  });

  const memberName = (id: string) => members?.find((m) => m.id === id)?.name ?? "—";
  const cycleById = (id: string | null) => cycles?.find((c) => c.id === id);

  function cycleRange(id: string | null): { start: string; end: string; label: string } {
    const c = cycleById(id);
    if (c) return { start: c.start_date, end: c.end_date, label: c.name };
    return {
      start: currentCycle.start.toISOString().slice(0, 10),
      end: currentCycle.end.toISOString().slice(0, 10),
      label: currentCycle.label,
    };
  }

  function actuals(t: MT) {
    const r = cycleRange(t.billing_cycle_id);
    const memberLeads = (leadsData ?? []).filter((l) => l.team_member_id === t.team_member_id && l.assigned_date >= r.start && l.assigned_date <= r.end);
    const leadCount = memberLeads.reduce((s, l) => s + Number(l.leads_count ?? 1), 0);
    const leadRev = memberLeads.reduce((s, l) => s + Number(l.revenue_generated ?? 0), 0);
    const manualRev = (revenueData ?? []).filter((x) => x.team_member_id === t.team_member_id && x.date >= r.start && x.date <= r.end).reduce((s, x) => s + Number(x.amount), 0);
    return { leadCount, rev: leadRev + manualRev, range: r };
  }

  const activeCycleId = cycles?.find((c) => c.is_active)?.id ?? null;
  const filtered = (targets ?? []).filter((t) => {
    if (filterMember !== "all" && t.team_member_id !== filterMember) return false;
    if (filterCycle === "active") return t.billing_cycle_id === activeCycleId;
    if (filterCycle === "all") return true;
    return t.billing_cycle_id === filterCycle;
  });

  function openCreate() {
    setForm({ id: "", team_member_id: "", billing_cycle_id: activeCycleId ?? "", revenue_target: 0, leads_target: 0, notes: "" });
    setOpen(true);
  }
  function openEdit(t: MT) {
    setForm({
      id: t.id, team_member_id: t.team_member_id, billing_cycle_id: t.billing_cycle_id ?? "",
      revenue_target: Number(t.revenue_target), leads_target: t.leads_target, notes: t.notes ?? "",
    });
    setOpen(true);
  }
  async function save() {
    if (!form.team_member_id) { toast.error("Select a team member"); return; }
    const payload = {
      team_member_id: form.team_member_id,
      billing_cycle_id: form.billing_cycle_id || null,
      revenue_target: Number(form.revenue_target) || 0,
      leads_target: Number(form.leads_target) || 0,
      notes: form.notes || null,
    };
    const q = form.id
      ? supabase.from("monthly_targets").update(payload).eq("id", form.id)
      : supabase.from("monthly_targets").insert(payload);
    const { error } = await q;
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Target updated" : "Target created");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["monthly-targets"] });
  }
  async function remove(id: string) {
    if (!confirm("Delete this target?")) return;
    await supabase.from("monthly_targets").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["monthly-targets"] });
  }

  const chartData = filtered.map((t) => {
    const a = actuals(t);
    return { name: memberName(t.team_member_id), Target: Number(t.revenue_target), Achieved: a.rev };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Monthly Targets</h2>
          <p className="text-sm text-muted-foreground">Per-member targets tied to billing cycles.</p>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />New Monthly Target</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{form.id ? "Edit" : "Set"} Monthly Target</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Team Member</Label>
                  <Select value={form.team_member_id} onValueChange={(v) => setForm({ ...form, team_member_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Billing Cycle</Label>
                  <Select value={form.billing_cycle_id || "none"} onValueChange={(v) => setForm({ ...form, billing_cycle_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Current cycle (default)</SelectItem>
                      {cycles?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.is_active ? " · active" : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Monthly Revenue Target (₹)</Label>
                    <Input type="number" value={form.revenue_target} onChange={(e) => setForm({ ...form, revenue_target: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Monthly Leads Target</Label>
                    <Input type="number" value={form.leads_target} onChange={(e) => setForm({ ...form, leads_target: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
              </div>
              <DialogFooter><Button onClick={save}>{form.id ? "Update" : "Save"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Member:</Label>
          <Select value={filterMember} onValueChange={setFilterMember}>
            <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Billing Cycle:</Label>
          <Select value={filterCycle} onValueChange={setFilterCycle}>
            <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active cycle</SelectItem>
              <SelectItem value="all">All cycles</SelectItem>
              {cycles?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {chartData.length > 0 && (
        <ChartCard title="Target vs Achievement" description="Revenue performance by team member">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                formatter={(v: number) => formatINR(v)}
              />
              <Legend />
              <Bar dataKey="Target" fill="hsl(var(--chart-2))" radius={[4,4,0,0]} />
              <Bar dataKey="Achieved" fill="hsl(var(--chart-1))" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtered.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground col-span-full">No monthly targets for this filter. Create one to begin.</Card>}
        {filtered.map((t) => {
          const a = actuals(t);
          const revPct = Number(t.revenue_target) ? Math.min(100, (a.rev / Number(t.revenue_target)) * 100) : 0;
          const leadPct = t.leads_target ? Math.min(100, (a.leadCount / t.leads_target) * 100) : 0;
          const remainingRev = Math.max(0, Number(t.revenue_target) - a.rev);
          const remainingPct = Math.max(0, 100 - revPct);
          const arpu = a.leadCount ? a.rev / a.leadCount : 0;
          return (
            <Card key={t.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{memberName(t.team_member_id)}</h3>
                  <p className="text-xs text-muted-foreground">{a.range.label}</p>
                  {t.notes && <p className="text-xs text-muted-foreground mt-1 italic">{t.notes}</p>}
                </div>
                {isStaff && (
                  <div className="flex">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(t.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Revenue: {formatINR(a.rev)} / {formatINR(t.revenue_target)}</span>
                    <span className="font-medium">{revPct.toFixed(0)}%</span>
                  </div>
                  <Progress value={revPct} />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Leads: {a.leadCount} / {t.leads_target}</span>
                    <span className="font-medium">{leadPct.toFixed(0)}%</span>
                  </div>
                  <Progress value={leadPct} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
                <div><span className="text-muted-foreground">Remaining:</span><div className="font-semibold">{formatINR(remainingRev)}</div></div>
                <div><span className="text-muted-foreground">Remaining %:</span><div className="font-semibold">{remainingPct.toFixed(0)}%</div></div>
                <div><span className="text-muted-foreground">ARPU:</span><div className="font-semibold">{formatINR(arpu)}</div></div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
