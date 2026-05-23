import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Shield, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const ROLES: AppRole[] = ["admin", "manager", "team_member"];

function SettingsPage() {
  const qc = useQueryClient();
  const { user, roles, isAdmin } = useAuth();
  const [fullName, setFullName] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (data?.full_name) setFullName(data.full_name);
      return data;
    },
  });

  const { data: allUsers } = useQuery({
    queryKey: ["all-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at");
      const { data: userRoles } = await supabase.from("user_roles").select("*");
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (userRoles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
      }));
    },
  });

  async function saveProfile() {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function setUserRole(userId: string, role: AppRole, hasRole: boolean) {
    if (hasRole) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role });
    }
    qc.invalidateQueries({ queryKey: ["all-users"] });
    toast.success("Role updated");
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Profile & access management</p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2"><User className="h-4 w-4" /><h3 className="font-semibold">My Profile</h3></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
          <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Your roles:</span>
          {roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
        </div>
        <Button onClick={saveProfile} size="sm">Save profile</Button>
      </Card>

      {isAdmin && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2"><Shield className="h-4 w-4" /><h3 className="font-semibold">User Access Management</h3></div>
          <p className="text-xs text-muted-foreground">Toggle roles for any user. Admins have full access, managers have operational access, team members have self-view access.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr className="text-left">
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Email</th>
                {ROLES.map((r) => <th key={r} className="px-3 py-2 font-medium text-center capitalize">{r.replace("_", " ")}</th>)}
              </tr></thead>
              <tbody>
                {(allUsers ?? []).map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-3 py-2">{u.full_name ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{u.email}</td>
                    {ROLES.map((r) => (
                      <td key={r} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={u.roles.includes(r)}
                          onChange={() => setUserRole(u.id, r, u.roles.includes(r))}
                          className="h-4 w-4 cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-5 space-y-2">
        <h3 className="font-semibold">About</h3>
        <p className="text-xs text-muted-foreground">TeamPulse Analytics Suite · 26th→25th billing cycle · Phase 1 + 7 modules complete</p>
      </Card>
    </div>
  );
}
