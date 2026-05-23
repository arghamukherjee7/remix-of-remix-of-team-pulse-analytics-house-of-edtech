import { createFileRoute } from "@tanstack/react-router";
import { formatINR } from "@/lib/currency";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Layers } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ChartCard } from "@/components/chart-card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/batches")({
  component: BatchesPage,
});

function BatchesPage() {
  const qc = useQueryClient();
  const { isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", total_leads: 0 });

  const { data: batches } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => (await supabase.from("batches").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: leads } = useQuery({
    queryKey: ["batch-leads"],
    queryFn: async () => (await supabase.from("leads").select("batch_id, revenue_generated, status")).data ?? [],
  });

  const stats = (batches ?? []).map((b) => {
    const bLeads = (leads ?? []).filter((l) => l.batch_id === b.id);
    const revenue = bLeads.reduce((s, l) => s + Number(l.revenue_generated), 0);
    const converted = bLeads.filter((l) => l.status === "converted").length;
    return { ...b, assigned: bLeads.length, revenue, converted, conversion: bLeads.length ? (converted / bLeads.length) * 100 : 0 };
  });

  async function create() {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    const { error } = await supabase.from("batches").insert(form);
    if (error) { toast.error(error.message); return; }
    toast.success("Batch created");
    setOpen(false); setForm({ name: "", description: "", total_leads: 0 });
    qc.invalidateQueries({ queryKey: ["batches"] });
  }
  async function remove(id: string) {
    if (!confirm("Delete this batch?")) return;
    const { error } = await supabase.from("batches").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["batches"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Batch Analytics</h2>
          <p className="text-sm text-muted-foreground">Lead batch performance & ROI</p>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Batch</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Batch</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} /></div>
                <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} /></div>
                <div><Label>Total leads expected</Label><Input type="number" value={form.total_leads} onChange={(e) => setForm({ ...form, total_leads: Number(e.target.value) })} /></div>
              </div>
              <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <ChartCard title="Revenue by Batch">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} />
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
            <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.length === 0 && <Card className="p-8 text-center text-muted-foreground text-sm col-span-full"><Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />No batches yet</Card>}
        {stats.map((b) => (
          <Card key={b.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{b.name}</h3>
                <p className="text-xs text-muted-foreground">{b.description || "—"}</p>
              </div>
              {isStaff && <Button variant="ghost" size="icon" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
              <div><p className="text-muted-foreground">Assigned</p><p className="font-semibold text-sm">{b.assigned} / {b.total_leads}</p></div>
              <div><p className="text-muted-foreground">Converted</p><p className="font-semibold text-sm">{b.converted}</p></div>
              <div><p className="text-muted-foreground">Revenue</p><p className="font-semibold text-sm">{formatINR(b.revenue)}</p></div>
              <div><p className="text-muted-foreground">Conversion</p><p className="font-semibold text-sm">{b.conversion.toFixed(1)}%</p></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
