import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Unified revenue source — merges manual revenue_entries with revenue_generated
 * recorded on lead assignments. This is the SINGLE SOURCE OF TRUTH for revenue
 * across the dashboard, analytics, reports, targets, and team performance.
 */
export type UnifiedRevenue = {
  id: string;
  date: string;
  amount: number;
  team_member_id: string | null;
  batch_id: string | null;
  source: "revenue_entry" | "lead";
  notes: string | null;
};

export type UnifiedLead = {
  id: string;
  assigned_date: string;
  team_member_id: string | null;
  batch_id: string | null;
  status: string;
  leads_count: number;
  revenue_generated: number;
};

export function useUnifiedRevenue(startISO: string, endISO: string) {
  const re = useQuery({
    queryKey: ["uni-rev-entries", startISO, endISO],
    queryFn: async () =>
      (await supabase
        .from("revenue_entries")
        .select("id, date, amount, team_member_id, batch_id, notes")
        .gte("date", startISO)
        .lte("date", endISO)).data ?? [],
  });

  const ld = useQuery({
    queryKey: ["uni-rev-leads", startISO, endISO],
    queryFn: async () =>
      (await supabase
        .from("leads")
        .select("id, assigned_date, team_member_id, batch_id, status, leads_count, revenue_generated")
        .gte("assigned_date", startISO)
        .lte("assigned_date", endISO)).data ?? [],
  });

  const entries: UnifiedRevenue[] = [
    ...(re.data ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      amount: Number(r.amount),
      team_member_id: r.team_member_id,
      batch_id: r.batch_id,
      source: "revenue_entry" as const,
      notes: r.notes ?? null,
    })),
    ...(ld.data ?? [])
      .filter((l) => Number(l.revenue_generated) > 0)
      .map((l) => ({
        id: l.id,
        date: l.assigned_date,
        amount: Number(l.revenue_generated),
        team_member_id: l.team_member_id,
        batch_id: l.batch_id,
        source: "lead" as const,
        notes: null,
      })),
  ];

  return {
    entries,
    leads: (ld.data ?? []) as UnifiedLead[],
    revenueEntries: re.data ?? [],
    isLoading: re.isLoading || ld.isLoading,
  };
}

/** Sum the `leads_count` column across lead rows (a single row may represent many leads). */
export function totalLeadsCount(leads: Pick<UnifiedLead, "leads_count">[]) {
  return leads.reduce((s, l) => s + Number(l.leads_count ?? 1), 0);
}
