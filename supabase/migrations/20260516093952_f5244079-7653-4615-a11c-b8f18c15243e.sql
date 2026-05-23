
-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'team_member');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'half_day', 'leave');
CREATE TYPE public.lead_status AS ENUM ('new', 'in_progress', 'converted', 'lost', 'follow_up');

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============= USER ROLES =============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','manager')
  )
$$;

-- ============= TEAM MEMBERS =============
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  team_group TEXT,
  joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_team_members_active ON public.team_members(active);

-- ============= BILLING CYCLES =============
CREATE TABLE public.billing_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (start_date, end_date)
);
ALTER TABLE public.billing_cycles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_billing_cycles_dates ON public.billing_cycles(start_date, end_date);

-- ============= BATCHES =============
CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  billing_cycle_id UUID REFERENCES public.billing_cycles(id) ON DELETE SET NULL,
  total_leads INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_batches_cycle ON public.batches(billing_cycle_id);

-- ============= LEADS =============
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_name TEXT NOT NULL,
  lead_phone TEXT,
  lead_email TEXT,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  team_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  billing_cycle_id UUID REFERENCES public.billing_cycles(id) ON DELETE SET NULL,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.lead_status NOT NULL DEFAULT 'new',
  revenue_generated NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_leads_team_member ON public.leads(team_member_id);
CREATE INDEX idx_leads_cycle ON public.leads(billing_cycle_id);
CREATE INDEX idx_leads_assigned_date ON public.leads(assigned_date);

-- ============= ATTENDANCE =============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  billing_cycle_id UUID REFERENCES public.billing_cycles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (team_member_id, date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_attendance_date ON public.attendance(date);
CREATE INDEX idx_attendance_cycle ON public.attendance(billing_cycle_id);

-- ============= REVENUE ENTRIES =============
CREATE TABLE public.revenue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  billing_cycle_id UUID REFERENCES public.billing_cycles(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.revenue_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_revenue_member ON public.revenue_entries(team_member_id);
CREATE INDEX idx_revenue_date ON public.revenue_entries(date);
CREATE INDEX idx_revenue_cycle ON public.revenue_entries(billing_cycle_id);

-- ============= WEEKLY TARGETS =============
CREATE TABLE public.weekly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_cycle_id UUID REFERENCES public.billing_cycles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  target_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  target_leads INTEGER NOT NULL DEFAULT 0,
  team_member_id UUID REFERENCES public.team_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.weekly_targets ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_targets_cycle ON public.weekly_targets(billing_cycle_id);

-- ============= KPI METRICS =============
CREATE TABLE public.kpi_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  billing_cycle_id UUID REFERENCES public.billing_cycles(id) ON DELETE SET NULL,
  call_attempts INTEGER NOT NULL DEFAULT 0,
  talk_time_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (team_member_id, date)
);
ALTER TABLE public.kpi_metrics ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_kpi_date ON public.kpi_metrics(date);
CREATE INDEX idx_kpi_cycle ON public.kpi_metrics(billing_cycle_id);

-- ============= TRIGGERS =============
-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- First registered user becomes admin; everyone else defaults to team_member
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'team_member');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============= RLS POLICIES =============
-- PROFILES
CREATE POLICY "profiles_select_own_or_staff" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin_or_manager(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- USER_ROLES (admin only manages roles)
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Helper to keep policies short
-- Generic policy template per operational table:
-- SELECT: authenticated users
-- INSERT/UPDATE/DELETE: admin or manager
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'team_members','billing_cycles','batches','leads',
    'attendance','revenue_entries','weekly_targets','kpi_metrics'
  ]) LOOP
    EXECUTE format('CREATE POLICY "%s_select_authed" ON public.%I FOR SELECT TO authenticated USING (true);', t, t);
    EXECUTE format('CREATE POLICY "%s_staff_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_manager(auth.uid()));', t, t);
    EXECUTE format('CREATE POLICY "%s_staff_update" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));', t, t);
    EXECUTE format('CREATE POLICY "%s_staff_delete" ON public.%I FOR DELETE TO authenticated USING (public.is_admin_or_manager(auth.uid()));', t, t);
  END LOOP;
END $$;
