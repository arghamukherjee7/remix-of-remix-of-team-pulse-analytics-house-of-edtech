
ALTER TABLE public.weekly_targets
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS public.monthly_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL,
  billing_cycle_id uuid,
  revenue_target numeric NOT NULL DEFAULT 0,
  leads_target integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_targets_select_authed" ON public.monthly_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "monthly_targets_staff_insert" ON public.monthly_targets
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_manager(auth.uid()));
CREATE POLICY "monthly_targets_staff_update" ON public.monthly_targets
  FOR UPDATE TO authenticated USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
CREATE POLICY "monthly_targets_staff_delete" ON public.monthly_targets
  FOR DELETE TO authenticated USING (is_admin_or_manager(auth.uid()));

CREATE TRIGGER monthly_targets_touch
  BEFORE UPDATE ON public.monthly_targets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
