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
import { Plus, Trash2, Copy, Pencil, Save } from "lucide-react";
import { getCurrentCycle, toISODate } from "@/lib/billing-cycle";
import { useAuth } from "@/hooks/use-auth";
import { formatINR } from "@/lib/currency";
import { ImportDialog } from "@/components/import-dialog";
import { exportToCsv } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/targets")({
  component: TargetsPage,
});

type TargetRow = {
  id: string; team_member_id: string | null; week_start: string; week_end: string;
  target_leads: number; target_revenue: number; name: string | null; notes: string | null;
  billing_cycle_id: string | null;
};

const emptyForm = {
  id: "" as string | null,
  team_member_id: "",
  week_start: toISODate(new Date()),
  week_end: toISODate(new Date()),
  target_leads: 0,
  target_revenue: 0,
  name: "",
  notes: "",
  billing_cycle_id: "" as string | "",
};

function TargetsPage() {
  const qc = useQueryClient();
  const { isStaff } = useAuth();
  const currentCycle = useMemo(() => getCurrentCycle(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [filterMember, setFilterMember] = useState("all");
  const [filterCycle, setFilterCycle] = useState("all");
  const [bulk, setBulk] = useState<Array<{ team_member_id: string; name: string; week_start: string; week_end: string; target_revenue: number; target_leads: number; notes: string }>>([]);

  const { data: members } = useQuery({
    queryKey: ["tgt-members"],
    queryFn: async () => (await supabase.from("team_members").select("id, name").eq("active", true).order("name")).data ?? [],
  });
  const { data: cycles } = useQuery({
    queryKey: ["tgt-cycles"],
    queryFn: async () => (await supabase.from("billing_cycles").select("id, name, start_date, end_date").order("start_date", { ascending: false })).data ?? [],
  });
  const { data: targets } = useQuery({
    queryKey: ["weekly-targets-all"],
    queryFn: async () => (await supabase.from("weekly_targets").select("*").order("week_start", { ascending: false })).data ?? [] as TargetRow[],
  });
  const { data: leadsData } = useQuery({
    queryKey: ["tgt-leads-all"],
    queryFn: async () => (await supabase.from("leads").select("team_member_id, assigned_date, revenue_generated, leads_count")).data ?? [],
  });
  const { data: revenueData } = useQuery({
    queryKey: ["tgt-rev-all"],
    queryFn: async () => (await supabase.from("revenue_entries").select("team_member_id, date, amount")).data ?? [],
  });

  const memberName = (id: string | null) => members?.find((m) => m.id === id)?.name ?? "—";

  function actuals(t: { team_member_id: string | null; week_start: string; week_end: string }) {
    const leadRows = (leadsData ?? []).filter((l) => l.team_member_id === t.team_member_id && l.assigned_date >= t.week_start && l.assigned_date <= t.week_end);
    const leadCount = leadRows.reduce((s, l) => s + Number((l as any).leads_count ?? 1), 0);
    const leadRev = leadRows.reduce((s, l) => s + Number((l as any).revenue_generated ?? 0), 0);
    const manualRev = (revenueData ?? []).filter((r) => r.team_member_id === t.team_member_id && r.date >= t.week_start && r.date <= t.week_end).reduce((s, r) => s + Number(r.amount), 0);
    return { leadCount, rev: leadRev + manualRev };
  }

  const filtered = (targets ?? []).filter((t) => {
    if (filterMember !== "all" && t.team_member_id !== filterMember) return false;
    if (filterCycle !== "all" && t.billing_cycle_id !== filterCycle) return false;
    return true;
  });

  function openCreate() {
    setForm({ ...emptyForm, week_start: toISODate(currentCycle.start), week_end: toISODate(currentCycle.end) });
    setOpen(true);
  }
  function openEdit(t: TargetRow) {
    setForm({
      id: t.id, team_member_id: t.team_member_id ?? "", week_start: t.week_start, week_end: t.week_end,
      target_leads: t.target_leads, target_revenue: Number(t.target_revenue),
      name: t.name ?? "", notes: t.notes ?? "", billing_cycle_id: t.billing_cycle_id ?? "",
    });
    setOpen(true);
  }
  function duplicate(t: TargetRow) {
    setForm({
      id: "", team_member_id: t.team_member_id ?? "", week_start: t.week_start, week_end: t.week_end,
      target_leads: t.target_leads, target_revenue: Number(t.target_revenue),
      name: t.name ? `${t.name} (copy)` : "", notes: t.notes ?? "", billing_cycle_id: t.billing_cycle_id ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.team_member_id) { toast.error("Select a team member"); return; }
    if (!form.week_start || !form.week_end) { toast.error("Pick both dates"); return; }
    if (form.week_end < form.week_start) { toast.error("End date must be after start date"); return; }
    const payload = {
      team_member_id: form.team_member_id,
      week_start: form.week_start,
      week_end: form.week_end,
      target_leads: Number(form.target_leads) || 0,
      target_revenue: Number(form.target_revenue) || 0,
      name: form.name || null,
      notes: form.notes || null,
      billing_cycle_id: form.billing_cycle_id || null,
    };
    const q = form.id
      ? supabase.from("weekly_targets").update(payload).eq("id", form.id)
      : supabase.from("weekly_targets").insert(payload);
    const { error } = await q;
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Target updated" : "Target created");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["weekly-targets-all"] });
  }
  async function remove(id: string) {
    if (!confirm("Delete this target?")) return;
    await supabase.from("weekly_targets").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["weekly-targets-all"] });
  }

  function addBulkRow(seed?: Partial<(typeof bulk)[number]>) {
    setBulk((b) => [...b, {
      team_member_id: seed?.team_member_id ?? "",
      name: seed?.name ?? "",
      week_start: seed?.week_start ?? toISODate(new Date()),
      week_end: seed?.week_end ?? toISODate(new Date()),
      target_revenue: seed?.target_revenue ?? 0,
      target_leads: seed?.target_leads ?? 0,
      notes: seed?.notes ?? "",
    }]);
  }
  function updateBulk(i: number, patch: Partial<(typeof bulk)[number]>) {
    setBulk((b) => b.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function fillAllMembers() {
    const tpl = bulk[bulk.length - 1] ?? { team_member_id: "", name: "", week_start: toISODate(new Date()), week_end: toISODate(new Date()), target_revenue: 0, target_leads: 0, notes: "" };
    const existing = new Set(bulk.map((r) => r.team_member_id));
    const adds = (members ?? []).filter((m) => !existing.has(m.id)).map((m) => ({ ...tpl, team_member_id: m.id }));
    setBulk((b) => [...b, ...adds]);
  }
  function duplicatePreviousWeek() {
    const prev: Record<string, any> = {};
    for (const t of targets ?? []) {
      const k = t.team_member_id ?? "";
      if (!prev[k] || prev[k].week_start < t.week_start) prev[k] = t;
    }
    setBulk(Object.values(prev).map((t: any) => ({
      team_member_id: t.team_member_id, name: t.name ?? "", week_start: t.week_start, week_end: t.week_end,
      target_revenue: Number(t.target_revenue) || 0, target_leads: t.target_leads ?? 0, notes: t.notes ?? "",
    })));
  }
  async function saveBulk() {
    const valid = bulk.filter((r) => r.team_member_id && r.week_start && r.week_end);
    if (!valid.length) { toast.error("Add valid rows"); return; }
    const payload = valid.map((r) => ({
      team_member_id: r.team_member_id, week_start: r.week_start, week_end: r.week_end,
      target_revenue: Number(r.target_revenue) || 0, target_leads: Number(r.target_leads) || 0,
      name: r.name || null, notes: r.notes || null,
    }));
    const { error } = await supabase.from("weekly_targets").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(`Saved ${payload.length} targets`); setBulk([]);
    qc.invalidateQueries({ queryKey: ["weekly-targets-all"] });
  }
  async function importTargets(input: Record<string, any>[]) {
    const byName = new Map((members ?? []).map((m) => [m.name.toLowerCase().trim(), m.id]));
    const payload: any[] = []; const errors: string[] = [];
    for (const r of input) {
      const name = String(r["Team Member"] ?? "").toLowerCase().trim();
      const ws = String(r["Week Start"] ?? "").trim();
      const we = String(r["Week End"] ?? "").trim();
      const mid = byName.get(name);
      if (!mid || !ws || !we) { errors.push(`Skipped ${name}`); continue; }
      payload.push({
        team_member_id: mid, week_start: ws, week_end: we,
        target_revenue: Number(r["Revenue Target"] ?? 0), target_leads: Number(r["Leads Target"] ?? 0),
        name: r["Week Name"] ? String(r["Week Name"]) : null, notes: r["Notes"] ? String(r["Notes"]) : null,
      });
    }
    if (payload.length) { const { error } = await supabase.from("weekly_targets").insert(payload); if (error) throw error; }
    qc.invalidateQueries({ queryKey: ["weekly-targets-all"] });
    return { inserted: payload.length, skipped: errors.length, errors };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Weekly Targets</h2>
          <p className="text-sm text-muted-foreground">Manual per-member weekly targets with custom date ranges.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportToCsv("weekly-targets.csv", targets ?? [])}>Export</Button>
          {isStaff && (
            <ImportDialog
              title="Import Weekly Targets"
              headers={["Team Member", "Week Name", "Week Start", "Week End", "Revenue Target", "Leads Target", "Notes"]}
              sample={[{ "Team Member": "Asha", "Week Name": "W1", "Week Start": "2026-05-26", "Week End": "2026-06-01", "Revenue Target": 50000, "Leads Target": 30, "Notes": "" }]}
              templateFilename="weekly-targets-template.xlsx"
              onImport={importTargets}
            />
          )}
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />New Target</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{form.id ? "Edit" : "Set"} Weekly Target</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Week Name (optional)</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Week 1 — March push" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Week Start Date</Label>
                    <Input type="date" value={form.week_start} onChange={(e) => setForm({ ...form, week_start: e.target.value })} />
                  </div>
                  <div>
                    <Label>Week End Date</Label>
                    <Input type="date" value={form.week_end} onChange={(e) => setForm({ ...form, week_end: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Team Member</Label>
                  <Select value={form.team_member_id} onValueChange={(v) => setForm({ ...form, team_member_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                    <SelectContent>{members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Weekly Revenue Target (₹)</Label>
                    <Input type="number" value={form.target_revenue} onChange={(e) => setForm({ ...form, target_revenue: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Weekly Leads Target</Label>
                    <Input type="number" value={form.target_leads} onChange={(e) => setForm({ ...form, target_leads: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <Label>Billing Cycle (optional)</Label>
                  <Select value={form.billing_cycle_id || "none"} onValueChange={(v) => setForm({ ...form, billing_cycle_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {cycles?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
      </div>

      {isStaff && (
        <Card className="overflow-hidden">
          <div className="p-3 border-b bg-muted/30 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm font-medium">Bulk Target Entry — {bulk.length} row{bulk.length === 1 ? "" : "s"}</div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => addBulkRow()}><Plus className="h-4 w-4 mr-1" />Add row</Button>
              <Button size="sm" variant="outline" onClick={fillAllMembers}>Fill all members</Button>
              <Button size="sm" variant="outline" onClick={duplicatePreviousWeek}><Copy className="h-4 w-4 mr-1" />Duplicate latest</Button>
              <Button size="sm" onClick={saveBulk} disabled={!bulk.length}><Save className="h-4 w-4 mr-1" />Save all</Button>
            </div>
          </div>
          {bulk.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs"><tr>
                  <th className="px-2 py-1.5 text-left">Member</th>
                  <th className="px-2 py-1.5 text-left">Week Name</th>
                  <th className="px-2 py-1.5 text-left">Start</th>
                  <th className="px-2 py-1.5 text-left">End</th>
                  <th className="px-2 py-1.5 text-right">Revenue ₹</th>
                  <th className="px-2 py-1.5 text-right">Leads</th>
                  <th />
                </tr></thead>
                <tbody>
                  {bulk.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">
                        <Select value={r.team_member_id} onValueChange={(v) => updateBulk(i, { team_member_id: v })}>
                          <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Member" /></SelectTrigger>
                          <SelectContent>{members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1"><Input value={r.name} onChange={(e) => updateBulk(i, { name: e.target.value })} className="h-8 w-32" /></td>
                      <td className="px-2 py-1"><Input type="date" value={r.week_start} onChange={(e) => updateBulk(i, { week_start: e.target.value })} className="h-8 w-36" /></td>
                      <td className="px-2 py-1"><Input type="date" value={r.week_end} onChange={(e) => updateBulk(i, { week_end: e.target.value })} className="h-8 w-36" /></td>
                      <td className="px-2 py-1"><Input type="number" value={r.target_revenue} onChange={(e) => updateBulk(i, { target_revenue: Number(e.target.value) })} className="h-8 w-28 text-right" /></td>
                      <td className="px-2 py-1"><Input type="number" value={r.target_leads} onChange={(e) => updateBulk(i, { target_leads: Number(e.target.value) })} className="h-8 w-20 text-right" /></td>
                      <td className="px-2"><Button variant="ghost" size="icon" onClick={() => setBulk((b) => b.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

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
              <SelectItem value="all">All cycles</SelectItem>
              {cycles?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtered.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground col-span-full">No targets match filters. Create one to get started.</Card>}
        {filtered.map((t) => {
          const a = actuals(t);
          const leadPct = t.target_leads ? Math.min(100, (a.leadCount / t.target_leads) * 100) : 0;
          const revPct = Number(t.target_revenue) ? Math.min(100, (a.rev / Number(t.target_revenue)) * 100) : 0;
          const remainingRev = Math.max(0, Number(t.target_revenue) - a.rev);
          const arpu = a.leadCount ? a.rev / a.leadCount : 0;
          return (
            <Card key={t.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{memberName(t.team_member_id)}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t.name ? `${t.name} · ` : ""}{t.week_start} → {t.week_end}
                  </p>
                  {t.notes && <p className="text-xs text-muted-foreground mt-1 italic">{t.notes}</p>}
                </div>
                {isStaff && (
                  <div className="flex">
                    <Button variant="ghost" size="icon" onClick={() => duplicate(t)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(t.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1"><span>Leads: {a.leadCount} / {t.target_leads}</span><span className="font-medium">{leadPct.toFixed(0)}%</span></div>
                  <Progress value={leadPct} />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Revenue: {formatINR(a.rev)} / {formatINR(t.target_revenue)}</span>
                    <span className="font-medium">{revPct.toFixed(0)}%</span>
                  </div>
                  <Progress value={revPct} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                <div><span className="text-muted-foreground">Remaining:</span> <span className="font-semibold">{formatINR(remainingRev)}</span></div>
                <div><span className="text-muted-foreground">ARPU:</span> <span className="font-semibold">{formatINR(arpu)}</span></div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
