import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard } from "@/components/kpi-card";
import { Check, X, Minus, Plane, Coffee } from "lucide-react";
import { getCurrentCycle, toISODate } from "@/lib/billing-cycle";
import { eachDayOfInterval, format, isWeekend } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { ImportDialog } from "@/components/import-dialog";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

type Status = "present" | "absent" | "half_day" | "leave" | "week_off";

const STATUS_CFG: Record<Status, { label: string; icon: typeof Check; cls: string }> = {
  present: { label: "P", icon: Check, cls: "bg-success/15 text-success border-success/30" },
  absent: { label: "A", icon: X, cls: "bg-destructive/15 text-destructive border-destructive/30" },
  half_day: { label: "H", icon: Minus, cls: "bg-warning/15 text-warning-foreground border-warning/30" },
  leave: { label: "L", icon: Plane, cls: "bg-accent/15 text-accent border-accent/30" },
  week_off: { label: "W", icon: Coffee, cls: "bg-muted text-muted-foreground border-border" },
};
const NEXT: Record<Status, Status> = { present: "absent", absent: "half_day", half_day: "leave", leave: "week_off", week_off: "present" };

function AttendancePage() {
  const qc = useQueryClient();
  const { isStaff } = useAuth();
  const cycle = useMemo(() => getCurrentCycle(), []);
  const days = useMemo(() => eachDayOfInterval({ start: cycle.start, end: cycle.end }), [cycle]);
  const startISO = toISODate(cycle.start);
  const endISO = toISODate(cycle.end);

  const { data: members } = useQuery({
    queryKey: ["att-members"],
    queryFn: async () => (await supabase.from("team_members").select("id, name").eq("active", true).order("name")).data ?? [],
  });
  const { data: records } = useQuery({
    queryKey: ["attendance", startISO, endISO],
    queryFn: async () => (await supabase.from("attendance").select("*").gte("date", startISO).lte("date", endISO)).data ?? [],
  });

  const map = new Map<string, Status>();
  (records ?? []).forEach((r) => map.set(`${r.team_member_id}|${r.date}`, r.status as Status));

  async function toggle(memberId: string, date: string) {
    if (!isStaff) return;
    const cur = map.get(`${memberId}|${date}`) ?? "absent";
    const next = NEXT[cur];
    const existing = (records ?? []).find((r) => r.team_member_id === memberId && r.date === date);
    const { error } = existing
      ? await supabase.from("attendance").update({ status: next }).eq("id", existing.id)
      : await supabase.from("attendance").insert({ team_member_id: memberId, date, status: next });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["attendance"] });
  }

  async function markAll(memberId: string, status: Status) {
    if (!isStaff) return;
    const inserts = days.filter((d) => !isWeekend(d)).map((d) => ({
      team_member_id: memberId, date: toISODate(d), status,
    }));
    const { error } = await supabase.from("attendance").upsert(inserts, { onConflict: "team_member_id,date" });
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked all ${status}`);
    qc.invalidateQueries({ queryKey: ["attendance"] });
  }

  // Stats
  const totalDays = days.length;
  const recs = records ?? [];
  const cnt = (s: Status) => recs.filter((r) => r.status === s).length;
  const presentCount = cnt("present");
  const absentCount = cnt("absent");
  const halfCount = cnt("half_day");
  const leaveCount = cnt("leave");
  const weekOffCount = cnt("week_off");
  // Week off doesn't reduce %: exclude week_off from the denominator
  const memberCount = members?.length ?? 0;
  const possible = Math.max(0, memberCount * totalDays - weekOffCount);
  const credited = presentCount + halfCount * 0.5;
  const pct = possible ? Math.round((credited / possible) * 100) : 0;

  async function importAttendance(rows: Record<string, any>[]) {
    const byName = new Map((members ?? []).map((m) => [m.name.toLowerCase().trim(), m.id]));
    const payload: { team_member_id: string; date: string; status: Status }[] = [];
    const errors: string[] = [];
    for (const r of rows) {
      const name = String(r["Team Member"] ?? r.name ?? "").toLowerCase().trim();
      const date = String(r["Date"] ?? r.date ?? "").trim();
      const status = String(r["Status"] ?? r.status ?? "").toLowerCase().trim().replace(/[\s-]/g, "_") as Status;
      const memberId = byName.get(name);
      if (!memberId || !date || !STATUS_CFG[status]) { errors.push(`Skipped ${name || "(no name)"} ${date}`); continue; }
      payload.push({ team_member_id: memberId, date, status });
    }
    if (payload.length) {
      const { error } = await supabase.from("attendance").upsert(payload, { onConflict: "team_member_id,date" });
      if (error) throw error;
    }
    qc.invalidateQueries({ queryKey: ["attendance"] });
    return { inserted: payload.length, skipped: errors.length, errors };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div>
          <h2 className="text-xl font-semibold">Attendance</h2>
          <p className="text-sm text-muted-foreground">{cycle.label} · Click cells to cycle status.</p>
        </div>
        {isStaff && (
          <ImportDialog
            title="Import Attendance"
            headers={["Team Member", "Date", "Status"]}
            sample={[{ "Team Member": "Asha", "Date": "2026-05-26", "Status": "present" }]}
            templateFilename="attendance-template.xlsx"
            onImport={importAttendance}
          />
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Present" value={presentCount} />
        <KpiCard label="Absent" value={absentCount} />
        <KpiCard label="Half Days" value={halfCount} />
        <KpiCard label="Leave" value={leaveCount} />
        <KpiCard label="Week Off" value={weekOffCount} />
        <KpiCard label="Attendance %" value={`${pct}%`} />
      </div>


      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left sticky left-0 bg-muted/50 z-10 font-medium min-w-[160px]">Member</th>
                {days.map((d) => (
                  <th key={d.toString()} className={cn("px-1 py-2 font-medium text-center min-w-[28px]", isWeekend(d) && "text-muted-foreground/50")}>
                    <div>{format(d, "dd")}</div>
                    <div className="text-[10px]">{format(d, "EEE")[0]}</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center min-w-[80px]">%</th>
                {isStaff && <th className="px-2 py-2 text-center">Bulk</th>}
              </tr>
            </thead>
            <tbody>
              {(members ?? []).length === 0 && (
                <tr><td colSpan={days.length + 2} className="px-4 py-8 text-center text-muted-foreground">Add team members first.</td></tr>
              )}
              {(members ?? []).map((m) => {
                const memberRecs = recs.filter((r) => r.team_member_id === m.id);
                const presented = memberRecs.filter((r) => r.status === "present").length;
                const half = memberRecs.filter((r) => r.status === "half_day").length;
                const wo = memberRecs.filter((r) => r.status === "week_off").length;
                const denom = Math.max(0, totalDays - wo);
                const memberPct = denom ? Math.round(((presented + half * 0.5) / denom) * 100) : 0;
                return (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-1.5 sticky left-0 bg-card font-medium z-10">{m.name}</td>
                    {days.map((d) => {
                      const dateStr = toISODate(d);
                      const status = map.get(`${m.id}|${dateStr}`);
                      const cfg = status ? STATUS_CFG[status] : null;
                      return (
                        <td key={dateStr} className={cn("p-0.5 text-center", isWeekend(d) && "bg-muted/30")}>
                          <button
                            onClick={() => toggle(m.id, dateStr)}
                            disabled={!isStaff}
                            className={cn(
                              "h-7 w-7 rounded text-[10px] font-bold border transition-colors",
                              cfg ? cfg.cls : "border-dashed border-border text-muted-foreground/40 hover:border-accent",
                              !isStaff && "cursor-not-allowed opacity-60",
                            )}
                          >
                            {cfg?.label ?? "·"}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-center font-semibold">{memberPct}%</td>
                    {isStaff && (
                      <td className="px-2 py-1.5">
                        <Select onValueChange={(v) => markAll(m.id, v as Status)}>
                          <SelectTrigger className="h-7 w-20 text-xs"><SelectValue placeholder="All…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">All Present</SelectItem>
                            <SelectItem value="absent">All Absent</SelectItem>
                            <SelectItem value="leave">All Leave</SelectItem>
                            <SelectItem value="week_off">All Week Off</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t p-3 flex flex-wrap gap-3 text-xs">
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded border font-bold", v.cls)}>{v.label}</span>
              <span className="capitalize">{k.replace("_", " ")}</span>
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
