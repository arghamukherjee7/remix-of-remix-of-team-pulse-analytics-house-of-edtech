import { Bell, Check, Trash2, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNotifications, type Notification } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const TYPE_CLS: Record<Notification["type"], string> = {
  info: "bg-accent/15 text-accent",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  error: "bg-destructive/15 text-destructive",
};

export function NotificationsBell() {
  const { notifications, unread, markRead, markAllRead, remove } = useNotifications();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold text-sm">Notifications</div>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unread === 0} className="h-7 text-xs">
            <CheckCheck className="h-3.5 w-3.5 mr-1" />Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">No notifications yet.</div>
          )}
          {notifications.map((n) => (
            <div key={n.id} className={cn("p-3 border-b flex gap-2 group", !n.is_read && "bg-muted/40")}>
              <Badge variant="outline" className={cn("h-5 capitalize", TYPE_CLS[n.type])}>{n.type}</Badge>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{n.title}</div>
                {n.message && <div className="text-xs text-muted-foreground">{n.message}</div>}
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </div>
              </div>
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => markRead(n.id, !n.is_read)} title={n.is_read ? "Mark unread" : "Mark read"}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(n.id)} title="Delete">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
