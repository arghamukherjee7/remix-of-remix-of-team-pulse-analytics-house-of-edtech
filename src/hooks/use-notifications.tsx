import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: "info" | "success" | "warning" | "error";
  is_read: boolean;
  link: string | null;
  created_at: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as Notification[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notifications-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        qc.invalidateQueries({ queryKey: ["notifications", user.id] });
        if (payload.eventType === "INSERT") {
          const n = payload.new as Notification;
          const fn = n.type === "error" ? toast.error : n.type === "warning" ? toast.warning : n.type === "success" ? toast.success : toast.info;
          fn(n.title, { description: n.message ?? undefined });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const unread = notifications.filter((n) => !n.is_read).length;

  async function markRead(id: string, is_read = true) {
    await supabase.from("notifications").update({ is_read }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  }
  async function markAllRead() {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  }
  async function remove(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  }
  async function notify(title: string, opts: { message?: string; type?: Notification["type"]; link?: string } = {}) {
    if (!user) return;
    await supabase.from("notifications").insert({
      user_id: user.id, title, message: opts.message ?? null, type: opts.type ?? "info", link: opts.link ?? null,
    });
  }

  return { notifications, unread, markRead, markAllRead, remove, notify };
}
