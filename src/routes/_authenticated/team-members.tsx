import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/team-members")({
  component: TeamMembersPage,
});

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  team_group: string | null;
  joined_date: string;
  active: boolean;
}

function TeamMembersPage() {
  const qc = useQueryClient();
  const { isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "", team_group: "", active: true });

  const { data: members, isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("*").order("name");
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", email: "", phone: "", role: "", team_group: "", active: true });
    setOpen(true);
  }
  function openEdit(m: TeamMember) {
    setEditing(m);
    setForm({
      name: m.name, email: m.email ?? "", phone: m.phone ?? "",
      role: m.role ?? "", team_group: m.team_group ?? "", active: m.active,
    });
    setOpen(true);
  }
  async function save() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = { ...form, name: form.name.trim() };
    const { error } = editing
      ? await supabase.from("team_members").update(payload).eq("id", editing.id)
      : await supabase.from("team_members").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Member updated" : "Member added");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["team-members"] });
  }
  async function remove(id: string) {
    if (!confirm("Delete this team member? Related data will be unlinked.")) return;
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    qc.invalidateQueries({ queryKey: ["team-members"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Team Members</h2>
          <p className="text-sm text-muted-foreground">Manage the people tracked in this workspace.</p>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Add Member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit Member" : "Add Team Member"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={50} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Role</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Sales Rep" maxLength={100} /></div>
                  <div><Label>Team / Group</Label><Input value={form.team_group} onChange={(e) => setForm({ ...form, team_group: e.target.value })} placeholder="Team A" maxLength={100} /></div>
                </div>
                <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
              </div>
              <DialogFooter><Button onClick={save}>{editing ? "Save changes" : "Add member"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Group</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Joined</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && (members ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-xs">No team members yet. Click "Add Member" to get started.</td></tr>
              )}
              {(members ?? []).map((m) => (
                <tr key={m.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{m.name}</td>
                  <td className="px-4 py-2">{m.role ?? "—"}</td>
                  <td className="px-4 py-2">{m.team_group ?? "—"}</td>
                  <td className="px-4 py-2">{m.email ?? "—"}</td>
                  <td className="px-4 py-2">{m.joined_date}</td>
                  <td className="px-4 py-2"><Badge variant={m.active ? "default" : "secondary"}>{m.active ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-4 py-2 text-right">
                    {isStaff && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
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
