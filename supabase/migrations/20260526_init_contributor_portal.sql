-- ════════════════════════════════════════════════════════════════
-- Contributor portal — initial schema
-- Run this once via Supabase dashboard → SQL Editor → New query → paste.
--
-- Creates:
--   - profiles table          (1:1 with auth.users; contributor metadata)
--   - thesis_updates table    (chronological feed of progress posts)
--   - RLS policies            (only signed-in users see content; only owners edit own profile)
--   - Trigger on auth.users   (auto-creates a profile shell on user creation)
-- ════════════════════════════════════════════════════════════════

-- ────────────────── profiles ──────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT UNIQUE NOT NULL,
  full_name           TEXT,
  role                TEXT,
  institution         TEXT,
  contributor_since   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.profiles IS '1:1 with auth.users — contributor metadata for the thesis portal.';
COMMENT ON COLUMN public.profiles.full_name IS 'Contributor displays this on the portal + as the From-name in editor notes.';

-- Updated-at maintenance
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create a profile shell whenever a new auth user is added.
-- Means: when you invite someone via Supabase dashboard → Auth → Users,
-- a corresponding profiles row exists immediately and the user only
-- has to fill in their name/role/institution.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────── thesis_updates ──────────────────
CREATE TABLE IF NOT EXISTS public.thesis_updates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS thesis_updates_published_at_idx
  ON public.thesis_updates (published_at DESC);

COMMENT ON TABLE public.thesis_updates IS
  'Chronological feed of thesis progress posts. Edited via Supabase dashboard SQL editor for v1.';

-- ────────────────── Row-Level Security ──────────────────
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thesis_updates  ENABLE ROW LEVEL SECURITY;

-- profiles: a signed-in user can read + update ONLY their own row
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- thesis_updates: any signed-in contributor can read; writes go through
-- the dashboard (service_role bypasses RLS, so SQL editor inserts work).
DROP POLICY IF EXISTS thesis_updates_authenticated_read ON public.thesis_updates;
CREATE POLICY thesis_updates_authenticated_read ON public.thesis_updates
  FOR SELECT TO authenticated
  USING (true);

-- ────────────────── done ──────────────────
-- Verify with:
--   SELECT * FROM public.profiles;           -- should show 0 rows until first user added
--   SELECT * FROM public.thesis_updates;     -- empty
--   SELECT * FROM pg_policies WHERE schemaname = 'public';  -- should list 3 policies above
