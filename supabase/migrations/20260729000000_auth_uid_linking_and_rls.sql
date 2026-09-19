-- 002: Auth UID linking and RLS adjustments

-- ── 1. auth_uids column ──────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_uids UUID[] NOT NULL DEFAULT '{}';

-- Backfill rows created under the old convention (users.id = auth.users.id)
UPDATE public.users u
SET auth_uids = ARRAY[u.id]
FROM auth.users au
WHERE au.id = u.id AND u.auth_uids = '{}';

CREATE INDEX IF NOT EXISTS users_auth_uids_idx ON public.users USING GIN (auth_uids);

-- ── 2. Link-on-sign-in trigger ───────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, auth_uids)
  VALUES (NEW.id, NEW.email, ARRAY[NEW.id])
  ON CONFLICT (email) DO UPDATE
    SET auth_uids = CASE
      WHEN NEW.id = ANY(public.users.auth_uids) THEN public.users.auth_uids
      ELSE array_append(public.users.auth_uids, NEW.id)
    END;
  RETURN NEW;
END;
$$;

-- ── 3. Identity resolver ─────────────────────────────────────
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.users WHERE auth.uid() = ANY(auth_uids) LIMIT 1
$$;

-- ── 4. Recreate policies with current_user_id() ──────────────
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users FOR SELECT TO authenticated
  USING (is_officer() OR id = current_user_id());

DROP POLICY IF EXISTS users_update ON users;
CREATE POLICY users_update ON users FOR UPDATE TO authenticated
  USING (is_officer());

DROP POLICY IF EXISTS accounts_select ON accounts;
CREATE POLICY accounts_select ON accounts FOR SELECT TO authenticated
  USING (is_officer() OR resident_id = current_user_id());

DROP POLICY IF EXISTS laundry_select ON laundry;
CREATE POLICY laundry_select ON laundry FOR SELECT TO authenticated
  USING (is_officer() OR resident_id = current_user_id());

DROP POLICY IF EXISTS laundry_insert ON laundry;
CREATE POLICY laundry_insert ON laundry FOR INSERT TO authenticated
  WITH CHECK (resident_id = current_user_id() OR is_officer());

DROP POLICY IF EXISTS laundry_update ON laundry;
CREATE POLICY laundry_update ON laundry FOR UPDATE TO authenticated
  USING (is_officer() OR resident_id = current_user_id());

DROP POLICY IF EXISTS pr_select ON payment_requests;
CREATE POLICY pr_select ON payment_requests FOR SELECT TO authenticated
  USING (is_officer() OR resident_id = current_user_id());

DROP POLICY IF EXISTS pr_insert ON payment_requests;
CREATE POLICY pr_insert ON payment_requests FOR INSERT TO authenticated
  WITH CHECK (resident_id = current_user_id() OR is_officer());

DROP POLICY IF EXISTS settings_select ON user_settings;
CREATE POLICY settings_select ON user_settings FOR SELECT TO authenticated
  USING (is_officer() OR resident_id = current_user_id());

DROP POLICY IF EXISTS settings_insert ON user_settings;
CREATE POLICY settings_insert ON user_settings FOR INSERT TO authenticated
  WITH CHECK (resident_id = current_user_id() OR is_officer());

DROP POLICY IF EXISTS settings_update ON user_settings;
CREATE POLICY settings_update ON user_settings FOR UPDATE TO authenticated
  USING (resident_id = current_user_id() OR is_officer());

-- ── 5. Resident self-registration into CURR ──────────────────
CREATE POLICY curr_insert_resident ON curr FOR INSERT TO authenticated
  WITH CHECK (
    is_officer() OR LOWER(email) = LOWER(COALESCE(auth.jwt()->>'email', ''))
  );
