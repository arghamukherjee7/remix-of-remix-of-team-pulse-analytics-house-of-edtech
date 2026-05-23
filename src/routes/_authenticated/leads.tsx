import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Download } from "lucide-react";
import { getCurrentCycle, toISODate } from "@/lib/billing-cycle";
import { useAuth } from "@/hooks/use-auth";
import { exportToCsv } from "@/lib/export";
import { formatINR } from "@/lib/currency";
import { ImportDialog } from "@/components/import-dialog";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

type Row = {
  id?: string;
  team_member_id: string;
  assigned_date: string;
  leads_count: number;
  revenue_generated: number;
  _dirty?: boolean;
  _new?: boolean;
};

function LeadsPage() {
  const qc = useQueryClient();
  const { isStaff } = useAuth();
  const cycle = useMemo(() => getCurrentCycle(), []);
  const [filterMember, setFilterMember] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterCycle, setFilterCycle] = useState<string>("current");
  const [draft, setDraft] = useState<Row[]>([]);

  const { data: members } = useQuery({
    queryKey: ["lead-members"],
    queryFn: async () => (await supabase.from("team_members").select("id, name").eq("active", true).order("name")).data ?? [],
  });
  const { data: cycles } = useQuery({
    queryKey: ["lead-cycles"],
    queryFn: async () => (await supabase.from("billing_cycles").select("id, name, start_date, end_date").order("start_date", { ascending: false })).data ?? [],
  });

  const cycleRange = useMemo(() => {
    if (filterCycle === "current") return { s: toISODate(cycle.start), e: toISODate(cycle.end) };
    if (filterCycle === "all") return null;
    const c = cycles?.find((c) => c.id === filterCycle);
    return c ? { s: c.start_date, e: c.end_date } : null;
  }, [filterCycle, cycle, cycles]);

  const { data: rows } = useQuery({
    queryKey: ["bulk-leads", cycleRange?.s, cycleRange?.e],
    queryFn: async () => {
      let q = supabase.from("leads").select("id, team_member_id, assigned_date, leads_count, revenue_generated").order("assigned_date", { ascending: false }).limit(2000);
      if (cycleRange) q = q.gte("assigned_date", cycleRange.s).lte("assigned_date", cycleRange.e);
      return (await q).data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return (rows ?? []).filter((r) =>
      (filterMember === "all" || r.team_member_id === filterMember) &&
      (!filterDate || r.assigned_date === filterDate),
    );
  }, [rows, filterMember, filterDate]);

  function updateDraft(i: number, patch: Partial<Row>) {
    setDraft((d) => d.map((r, idx) => (idx === i ? { ...r, ...patch, _dirty: true } : r)));
  }
  function addDraftRow() {
    setDraft((d) => [...d, {
      team_member_id: members?.[0]?.id ?? "",
      assigned_date: toISODate(new Date()),
      leads_count: 0,
      revenue_generated: 0,
      _new: true, _dirty: true,
    }]);
  }
  function removeDraft(i: number) { setDraft((d) => d.filter((_, idx) => idx !== i)); }

  async function saveAll() {
    const valid = draft.filter((r) => r.team_member_id && r.assigned_date);
    if (!valid.length) { toast.error("Nothing to save"); return; }
    const payload = valid.map((r) => ({
      team_member_id: r.team_member_id,
      assigned_date: r.assigned_date,
      leads_count: Number(r.leads_count) || 0,
      revenue_generated: Number(r.revenue_generated) || 0,
      lead_name: `Bulk · ${r.assigned_date}`,
      status: "new" as const,
    }));
    const { error } = await supabase.from("leads").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(`Saved ${payload.length} rows`);
    setDraft([]);
    qc.invalidateQueries({ queryKey: ["bulk-leads"] });
  }

  async function updateRow(id: string, patch: { leads_count?: number; revenue_generated?: number }) {
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["bulk-leads"] });
  }
  async function deleteRow(id: string) {
    if (!confirm("Delete this row?")) return;
    await supabase.from("leads").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["bulk-leads"] });
  }

  async function importLeads(input: Record<string, any>[]) {
    const byName = new Map((members ?? []).map((m) => [m.name.toLowerCase().trim(), m.id]));
    const payload: any[] = []; const errors: string[] = [];
    for (const r of input) {
      const name = String(r["Team Member"] ?? "").toLowerCase().trim();
      const date = String(r["Assigned Date"] ?? r["Date"] ?? "").trim();
      const count = Number(r["Leads Assigned"] ?? r["Leads"] ?? 0);
      const rev = Number(r["Revenue"] ?? r["Revenue Generated"] ?? 0);
      const mid = byName.get(name);
      if (!mid || !date) { errors.push(`Skipped ${name} ${date}`); continue; }
      payload.push({ team_member_id: mid, assigned_date: date, leads_count: count, revenue_generated: rev, lead_name: `Import · ${date}`, status: "new" });
    }
    if (payload.length) {
      const { error } = await supabase.from("leads").insert(payload);
      if (error) throw error;
    }
    qc.invalidateQueries({ queryKey: ["bulk-leads"] });
    return { inserted: payload.length, skipped: errors.length, errors };
  }

  const memberName = (id: string) => members?.find((m) => m.id === id)?.name ?? "—";
  const totalLeads = filtered.reduce((s, r) => s + Number(r.leads_count || 0), 0);
  const totalRev = filtered.reduce((s, r) => s + Number(r.revenue_generated || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Lead Assignment</h2>
          <p className="text-sm text-muted-foreground">Bulk entry · {totalLeads} leads · {formatINR(totalRev)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportToCsv("leads.csv", filtered)}><Download className="h-4 w-4 mr-1" />Export</Button>
          {isStaff && (
            <ImportDialog
              title="Import Lead Assignments"
              headers={["Team Member", "Assigned Date", "Leads Assigned", "Revenue"]}
              sample={[{ "Team Member": "Asha", "Assigned Date": "2026-05-26", "Leads Assigned": 10, "Revenue": 25000 }]}
              templateFilename="leads-template.xlsx"
              onImport={importLeads}
            />
          )}
        </div>
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Cycle:</Label>
          <Select value={filterCycle} onValueChange={setFilterCycle}>
            <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current cycle</SelectItem>
              <SelectItem value="all">All time</SelectItem>
              {cycles?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Member:</Label>
          <Select value={filterMember} onValueChange={setFilterMember}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Date:</Label>
          <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="h-8 w-40" />
          {filterDate && <Button size="sm" variant="ghost" onClick={() => setFilterDate("")}>Clear</Button>}
        </div>
      </Card>

      {isStaff && (
        <Card className="overflow-hidden">
          <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
            <div className="text-sm font-medium">Bulk Entry — {draft.length} draft row{draft.length === 1 ? "" : "s"}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={addDraftRow}><Plus className="h-4 w-4 mr-1" />Add row</Button>
              <Button size="sm" onClick={saveAll} disabled={!draft.length}><Save className="h-4 w-4 mr-1" />Save all</Button>
            </div>
          </div>
          {draft.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Team Member</th>
                    <th className="px-2 py-1.5 text-left">Assigned Date</th>
                    <th className="px-2 py-1.5 text-right">Leads</th>
                    <th className="px-2 py-1.5 text-right">Revenue (₹)</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {draft.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">
                        <Select value={r.team_member_id} onValueChange={(v) => updateDraft(i, { team_member_id: v })}>
                          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>{members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1"><Input type="date" value={r.assigned_date} onChange={(e) => updateDraft(i, { assigned_date: e.target.value })} className="h-8 w-36" /></td>
                      <td className="px-2 py-1"><Input type="number" value={r.leads_count} onChange={(e) => updateDraft(i, { leads_count: Number(e.target.value) })} className="h-8 w-24 text-right" /></td>
                      <td className="px-2 py-1"><Input type="number" value={r.revenue_generated} onChange={(e) => updateDraft(i, { revenue_generated: Number(e.target.value) })} className="h-8 w-32 text-right" /></td>
                      <td className="px-2"><Button variant="ghost" size="icon" onClick={() => removeDraft(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Team Member</th>
                <th className="px-3 py-2 text-left">Assigned Date</th>
                <th className="px-3 py-2 text-right">Leads</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">No assignments. Use Bulk Entry above.</td></tr>}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-1.5 font-medium">{memberName(r.team_member_id ?? "")}</td>
                  <td className="px-3 py-1.5">{r.assigned_date}</td>
                  <td className="px-3 py-1.5 text-right">
                    {isStaff ? <Input type="number" defaultValue={r.leads_count} onBlur={(e) => updateRow(r.id, { leads_count: Number(e.target.value) })} className="h-7 w-20 text-right ml-auto" /> : r.leads_count}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {isStaff ? <Input type="number" defaultValue={r.revenue_generated} onBlur={(e) => updateRow(r.id, { revenue_generated: Number(e.target.value) })} className="h-7 w-28 text-right ml-auto" /> : formatINR(r.revenue_generated)}
                  </td>
                  <td className="px-2">{isStaff && <Button variant="ghost" size="icon" onClick={() => deleteRow(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-muted/30 font-semibold text-xs">
                <tr><td className="px-3 py-2" colSpan={2}>Totals</td><td className="px-3 py-2 text-right">{totalLeads}</td><td className="px-3 py-2 text-right">{formatINR(totalRev)}</td><td /></tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
