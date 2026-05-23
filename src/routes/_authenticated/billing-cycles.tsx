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
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarCheck, Trash2 } from "lucide-react";
import { getCurrentCycle, toISODate, formatCycleLabel } from "@/lib/billing-cycle";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/billing-cycles")({
  component: BillingCyclesPage,
});

interface Cycle { id: string; name: string; start_date: string; end_date: string; is_active: boolean; notes: string | null; }

function BillingCyclesPage() {
  const qc = useQueryClient();
  const { isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const current = useMemo(() => getCurrentCycle(), []);
  const [form, setForm] = useState({
    name: `Cycle ${formatCycleLabel(current.start, current.end)}`,
    start_date: toISODate(current.start),
    end_date: toISODate(current.end),
    notes: "",
  });

  const { data: cycles, isLoading } = useQuery({
    queryKey: ["billing-cycles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("billing_cycles").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data as Cycle[];
    },
  });

  async function create() {
    if (!form.name.trim() || !form.start_date || !form.end_date) { toast.error("All fields required"); return; }
    const { error } = await supabase.from("billing_cycles").insert(form);
    if (error) { toast.error(error.message); return; }
    toast.success("Cycle created");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["billing-cycles"] });
  }

  async function setActive(id: string) {
    // deactivate all, then activate one
    await supabase.from("billing_cycles").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    const { error } = await supabase.from("billing_cycles").update({ is_active: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Active cycle updated");
    qc.invalidateQueries({ queryKey: ["billing-cycles"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this cycle?")) return;
    const { error } = await supabase.from("billing_cycles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["billing-cycles"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Billing Cycles</h2>
          <p className="text-sm text-muted-foreground">Custom 26th-to-25th cycles. Create future cycles, archive old ones.</p>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Cycle</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Billing Cycle</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Start (26th)</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                  <div><Label>End (25th)</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                </div>
                <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} /></div>
              </div>
              <DialogFooter><Button onClick={create}>Create cycle</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="p-4 bg-accent/5 border-accent/20">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-5 w-5 text-accent" />
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Current Cycle (auto-detected)</p>
            <p className="font-semibold">{current.label}</p>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Start</th>
                <th className="px-4 py-2 font-medium">End</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && (cycles ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">No cycles yet. Create your first cycle to start tracking.</td></tr>
              )}
              {(cycles ?? []).map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2">{c.start_date}</td>
                  <td className="px-4 py-2">{c.end_date}</td>
                  <td className="px-4 py-2">{c.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Archived</Badge>}</td>
                  <td className="px-4 py-2 text-right space-x-1">
                    {isStaff && !c.is_active && <Button variant="outline" size="sm" onClick={() => setActive(c.id)}>Set Active</Button>}
                    {isStaff && <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
