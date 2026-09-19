-- 005: Schema consistency fixes with Google Sheets
--
-- 1. Create fridge_items table with RLS
-- 2. Add calendar_view to user_settings
-- 3. Add decline_reason to curr
-- 4. Add created_at to achievement_records
-- 5. Fix accounts.issuer_id FK constraint to reference users(id)

-- ── 1. Fridge Items Table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fridge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  compartment TEXT DEFAULT 'REFRIGERATOR',
  location_details TEXT,
  date_stored DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  photo_url TEXT,
  status TEXT DEFAULT 'STORED',
  notes TEXT,
  check_out_date TIMESTAMPTZ,
  tags TEXT[],
  action_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fridge_items_resident_id_idx ON public.fridge_items(resident_id);
CREATE INDEX IF NOT EXISTS fridge_items_status_idx ON public.fridge_items(status);
CREATE INDEX IF NOT EXISTS fridge_items_date_stored_idx ON public.fridge_items(date_stored);

ALTER TABLE public.fridge_items ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.fridge_items TO authenticated;

DROP POLICY IF EXISTS "fridge_items_select" ON public.fridge_items;
CREATE POLICY "fridge_items_select" ON public.fridge_items FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "fridge_items_insert" ON public.fridge_items;
CREATE POLICY "fridge_items_insert" ON public.fridge_items FOR INSERT TO authenticated
  WITH CHECK (is_officer() OR resident_id = current_user_id());

DROP POLICY IF EXISTS "fridge_items_update" ON public.fridge_items;
CREATE POLICY "fridge_items_update" ON public.fridge_items FOR UPDATE TO authenticated
  USING (is_officer() OR resident_id = current_user_id());

DROP POLICY IF EXISTS "fridge_items_delete" ON public.fridge_items;
CREATE POLICY "fridge_items_delete" ON public.fridge_items FOR DELETE TO authenticated
  USING (is_officer() OR resident_id = current_user_id());

-- ── 2. Add calendar_view to user_settings ──────────────────────
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS calendar_view TEXT DEFAULT 'week';

-- ── 3. Add decline_reason to curr ─────────────────────────────
ALTER TABLE public.curr
  ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- ── 4. Add created_at to achievement_records ──────────────────
ALTER TABLE public.achievement_records
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ── 5. Fix accounts.issuer_id FK constraint ────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'accounts_issuer_id_fkey' AND table_name = 'accounts'
  ) THEN
    ALTER TABLE public.accounts DROP CONSTRAINT accounts_issuer_id_fkey;
  END IF;
  ALTER TABLE public.accounts
    ADD CONSTRAINT accounts_issuer_id_fkey
    FOREIGN KEY (issuer_id) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;
