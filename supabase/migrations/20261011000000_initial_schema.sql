-- ============================================================
-- 1. Tables
-- ============================================================

-- ── users ──────────────────────────────────────────────────
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,                -- Stored lowercase (normalized by trigger)
  auth_uids UUID[] NOT NULL DEFAULT '{}',    -- Linked auth.users ids; each uid belongs to one user
  last_name TEXT,
  first_name TEXT,
  middle_name TEXT,
  suffix TEXT,
  override_name TEXT,
  student_no TEXT,
  secondary_contact TEXT,
  address TEXT,
  college TEXT,
  degree_program TEXT,
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Computes display_name and display_name_fl.
CREATE OR REPLACE VIEW users_view WITH (security_invoker = true) AS
SELECT
  id,
  email,
  last_name,
  first_name,
  middle_name,
  suffix,
  override_name,
  CASE
    WHEN override_name IS NOT NULL AND TRIM(override_name) <> '' THEN TRIM(override_name)
    ELSE TRIM(CONCAT(
      CASE WHEN last_name IS NOT NULL AND TRIM(last_name) <> '' THEN CONCAT(TRIM(last_name), ', ') ELSE '' END,
      TRIM(CONCAT_WS(' ', NULLIF(TRIM(first_name), ''), NULLIF(TRIM(suffix), '')))
    ))
  END AS display_name,
  CASE
    WHEN override_name IS NOT NULL AND TRIM(override_name) <> '' THEN TRIM(override_name)
    ELSE TRIM(CONCAT_WS(' ', NULLIF(TRIM(first_name), ''), NULLIF(TRIM(middle_name), ''), NULLIF(TRIM(last_name), ''), NULLIF(TRIM(suffix), '')))
  END AS display_name_fl,
  student_no,
  secondary_contact,
  address,
  college,
  degree_program,
  tags,
  notes,
  created_at
FROM users;

-- ── officers ───────────────────────────────────────────────
CREATE TABLE officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT,
  name TEXT,
  nickname TEXT,
  email TEXT NOT NULL,                       -- Must match users.email
  fb_link TEXT,
  term TEXT,
  committee TEXT,
  birthday DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT officers_status_chk CHECK (status IN ('ACTIVE', 'INACTIVE'))   -- TODO: confirm allowed values
);

-- ── accounts ───────────────────────────────────────────────
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES users(id),
  period TEXT NOT NULL,
  room TEXT,
  bed TEXT,
  ce_ref_no TEXT,
  ce_issued DATE,
  ce_link TEXT,
  account_notes TEXT,
  issuer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  check_in_date DATE,
  type TEXT NOT NULL DEFAULT 'STUDENT',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT accounts_resident_period_uniq UNIQUE (resident_id, period),
  CONSTRAINT accounts_type_chk CHECK (type IN ('STUDENT', 'BOOTCAMP', 'TRANSIENT', 'ALUMNUS', 'FACULTY', 'STAFF', 'REPS'))
);

-- ── journal ────────────────────────────────────────────────
CREATE TABLE journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  account_id UUID REFERENCES users(id) ON DELETE SET NULL,
  water NUMERIC(12, 2) DEFAULT 0,
  assoc NUMERIC(12, 2) DEFAULT 0,
  misc NUMERIC(12, 2) DEFAULT 0,
  mop TEXT,
  period TEXT,
  type TEXT,
  notes TEXT,
  notes_private TEXT,
  mop_ref_no TEXT,
  pr_date_issued DATE,
  pr_ref_no TEXT,
  was_audited BOOLEAN DEFAULT FALSE,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── laundry ────────────────────────────────────────────────
CREATE TABLE laundry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES users(id),
  date DATE NOT NULL,
  time_start TEXT NOT NULL,
  time_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,                  -- Set by trigger
  CONSTRAINT laundry_status_chk CHECK (status IN ('ACTIVE', 'CANCELLED')),   -- TODO: confirm allowed values
  CONSTRAINT laundry_cancel_consistency_chk CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL)),
  CONSTRAINT laundry_cancel_reason_chk CHECK (cancel_reason IS NULL OR status = 'CANCELLED')
);

-- ── payment_requests ───────────────────────────────────────
CREATE TABLE payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES users(id),
  date DATE DEFAULT CURRENT_DATE,
  water_fee NUMERIC(12, 2) DEFAULT 0,
  assoc_fee NUMERIC(12, 2) DEFAULT 0,
  misc NUMERIC(12, 2) DEFAULT 0,
  mop TEXT,
  type TEXT,
  proof_link TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  status_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT payment_requests_status_chk CHECK (status IN ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED')),   -- TODO: confirm allowed values
  CONSTRAINT payment_requests_amounts_chk CHECK (
    COALESCE(water_fee, 0) >= 0 AND COALESCE(assoc_fee, 0) >= 0 AND COALESCE(misc, 0) >= 0
  )
);

-- ── announcements ──────────────────────────────────────────
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  start_date DATE,
  expiry_date DATE,
  is_indefinite BOOLEAN DEFAULT FALSE,
  is_admin_only BOOLEAN DEFAULT FALSE,
  is_unlisted BOOLEAN DEFAULT FALSE,
  tags TEXT[],
  title TEXT,
  content TEXT,
  slug TEXT UNIQUE,
  broadcast_count INT DEFAULT 0,
  CONSTRAINT announcements_dates_chk CHECK (start_date IS NULL OR expiry_date IS NULL OR expiry_date >= start_date),
  CONSTRAINT announcements_broadcast_count_chk CHECK (broadcast_count >= 0)
);

-- ── user_settings ──────────────────────────────────────────
CREATE TABLE user_settings (
  resident_id UUID PRIMARY KEY REFERENCES users(id),
  is_public_achievement_list BOOLEAN DEFAULT TRUE,
  resident_nav TEXT,
  admin_nav TEXT,
  density TEXT DEFAULT 'default',
  typography TEXT DEFAULT 'inter',
  theme TEXT DEFAULT 'system',
  is_reduced_motion BOOLEAN DEFAULT FALSE,
  clock_format TEXT DEFAULT '12h',
  calendar_view TEXT DEFAULT 'week',
  CONSTRAINT user_settings_theme_chk CHECK (theme IN ('system', 'light', 'dark')),   -- TODO: confirm allowed values
  CONSTRAINT user_settings_clock_format_chk CHECK (clock_format IN ('12h', '24h'))
);

-- ── achievements ───────────────────────────────────────────
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id),
  name TEXT,
  description TEXT,
  icon TEXT,
  extra_url TEXT,
  term TEXT,
  points INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT achievements_points_chk CHECK (points >= 0)   -- TODO: confirm allowed values
);

-- ── achievement_records ────────────────────────────────────
CREATE TABLE achievement_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorder_id UUID REFERENCES users(id),
  account_id UUID REFERENCES users(id),
  date DATE DEFAULT CURRENT_DATE,
  achievement_id UUID REFERENCES achievements(id),
  term TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── constants ──────────────────────────────────────────────
CREATE TABLE constants (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT
);

-- ── registrations ──────────────────────────────────────────
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  email TEXT NOT NULL,                       -- Stored lowercase (normalized by trigger)
  room TEXT,
  bed TEXT,
  program TEXT,
  student_no TEXT,
  check_in_date DATE,
  last_name TEXT,
  first_name TEXT,
  college TEXT,
  evaluated BOOLEAN DEFAULT FALSE,
  term TEXT,
  account_type TEXT NOT NULL DEFAULT 'STUDENT',
  suffix TEXT,
  override_name TEXT,
  decline_reason TEXT,
  CONSTRAINT registrations_account_type_chk CHECK (account_type IN ('STUDENT', 'BOOTCAMP', 'TRANSIENT', 'ALUMNUS', 'FACULTY', 'STAFF', 'REPS'))
);

-- ── fridge_items ───────────────────────────────────────────
CREATE TABLE fridge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  compartment TEXT NOT NULL DEFAULT 'REFRIGERATOR',
  location_details TEXT,
  date_stored DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'STORED',
  notes TEXT,
  check_out_date TIMESTAMPTZ,
  tags TEXT[],
  action_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fridge_items_compartment_chk CHECK (compartment IN ('REFRIGERATOR', 'FREEZER')),            -- TODO: confirm allowed values
  CONSTRAINT fridge_items_status_chk CHECK (status IN ('STORED', 'CHECKED_OUT', 'DISCARDED')),          -- TODO: confirm allowed values
  CONSTRAINT fridge_items_expiry_chk CHECK (expiry_date IS NULL OR date_stored IS NULL OR expiry_date >= date_stored)
);

-- ============================================================
-- 2. Views
-- ============================================================
-- These views run with invoker privileges; SECURITY DEFINER helper functions
-- below expose only the columns and rows residents are permitted to see.

-- Names, email and tags for all residents (excludes notes, address,
-- secondary_contact, student_no and auth_uids).
CREATE OR REPLACE FUNCTION get_resident_directory()
RETURNS TABLE (
  id UUID,
  email TEXT,
  last_name TEXT,
  first_name TEXT,
  middle_name TEXT,
  suffix TEXT,
  override_name TEXT,
  display_name TEXT,
  display_name_fl TEXT,
  tags TEXT[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    u.id,
    u.email,
    u.last_name,
    u.first_name,
    u.middle_name,
    u.suffix,
    u.override_name,
    CASE
      WHEN u.override_name IS NOT NULL AND TRIM(u.override_name) <> '' THEN TRIM(u.override_name)
      ELSE TRIM(CONCAT(
        CASE WHEN u.last_name IS NOT NULL AND TRIM(u.last_name) <> '' THEN CONCAT(TRIM(u.last_name), ', ') ELSE '' END,
        TRIM(CONCAT_WS(' ', NULLIF(TRIM(u.first_name), ''), NULLIF(TRIM(u.suffix), '')))
      ))
    END AS display_name,
    CASE
      WHEN u.override_name IS NOT NULL AND TRIM(u.override_name) <> '' THEN TRIM(u.override_name)
      ELSE TRIM(CONCAT_WS(' ', NULLIF(TRIM(u.first_name), ''), NULLIF(TRIM(u.middle_name), ''), NULLIF(TRIM(u.last_name), ''), NULLIF(TRIM(u.suffix), '')))
    END AS display_name_fl,
    u.tags
  FROM public.users u
  WHERE auth.role() = 'authenticated';
$$;

CREATE OR REPLACE VIEW resident_directory WITH (security_invoker = true) AS
SELECT * FROM get_resident_directory();

-- Achievements of residents whose list is public (default when no settings row
-- exists). A resident's own records are read from achievement_records.
CREATE OR REPLACE FUNCTION get_public_achievements()
RETURNS TABLE (
  id UUID,
  resident_id UUID,
  display_name TEXT,
  display_name_fl TEXT,
  date TEXT,
  term TEXT,
  achievement_id TEXT,
  name TEXT,
  description TEXT,
  icon TEXT,
  extra_url TEXT,
  points NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    r.id,
    r.account_id AS resident_id,
    d.display_name,
    d.display_name_fl,
    r.date,
    r.term,
    r.achievement_id,
    a.name,
    a.description,
    a.icon,
    a.extra_url,
    a.points,
    r.created_at
  FROM public.achievement_records r
  JOIN public.achievements a ON a.id = r.achievement_id
  JOIN public.get_resident_directory() d ON d.id = r.account_id
  LEFT JOIN public.user_settings s ON s.resident_id = r.account_id
  WHERE auth.role() = 'authenticated'
    AND COALESCE(s.is_public_achievement_list, TRUE);
$$;

CREATE OR REPLACE VIEW public_achievements WITH (security_invoker = true) AS
SELECT * FROM get_public_achievements();

-- Fridge items with the owner's name. Runs as the invoker so fridge_items RLS applies.
CREATE OR REPLACE VIEW fridge_items_view WITH (security_invoker = true) AS
SELECT
  f.*,
  d.display_name    AS resident_display_name,
  d.display_name_fl AS resident_display_name_fl
FROM fridge_items f
LEFT JOIN resident_directory d ON d.id = f.resident_id;

-- ============================================================
-- 3. Indexes
-- ============================================================

CREATE INDEX users_auth_uids_idx           ON users USING GIN (auth_uids);
CREATE INDEX officers_email_idx            ON officers (email);
CREATE INDEX accounts_period               ON accounts (period);   -- (resident_id, period) is covered by the unique constraint
CREATE INDEX journal_account_id_idx        ON journal (account_id);
CREATE INDEX journal_creator_id_idx        ON journal (creator_id);
CREATE INDEX journal_period                ON journal (period);
CREATE INDEX laundry_resident_id           ON laundry (resident_id);
CREATE UNIQUE INDEX laundry_active_slot_uniq ON laundry (date, time_start, time_end) WHERE status = 'ACTIVE';  -- Prevents double booking a slot
CREATE INDEX payment_requests_resident_id  ON payment_requests (resident_id);
CREATE INDEX achievement_records_account_id      ON achievement_records (account_id);
CREATE INDEX achievement_records_achievement_id  ON achievement_records (achievement_id);
CREATE INDEX registrations_email_idx       ON registrations (email);
CREATE INDEX registrations_term_idx        ON registrations (term);
CREATE INDEX fridge_items_resident_id_idx  ON fridge_items (resident_id);
CREATE INDEX fridge_items_status_idx       ON fridge_items (status);
CREATE INDEX fridge_items_date_stored_idx  ON fridge_items (date_stored);

-- ============================================================
-- 4. Functions
-- ============================================================

-- Resolves auth.uid() to users.id. Uses @> so the GIN index can be used.
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.users WHERE auth_uids @> ARRAY[auth.uid()] LIMIT 1
$$;

-- True for active officers, matched through users.email. Does not check officers.term.
CREATE OR REPLACE FUNCTION is_officer()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.officers o
    JOIN public.users u ON u.email = o.email
    WHERE u.id = public.current_user_id()
      AND UPPER(BTRIM(COALESCE(o.status, ''))) = 'ACTIVE'
  );
$$;

-- Laundry access for the current user. Raises if constants.TERM_CURR is not set.
CREATE OR REPLACE FUNCTION can_access_laundry()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_term TEXT;
  v_type TEXT;
BEGIN
  SELECT value INTO v_term FROM public.constants WHERE key = 'TERM_CURR';
  IF v_term IS NULL OR BTRIM(v_term) = '' THEN
    RAISE EXCEPTION 'constants.TERM_CURR is not set';
  END IF;

  -- At most one account per resident per period
  SELECT type INTO v_type
  FROM public.accounts
  WHERE resident_id = public.current_user_id() AND period = v_term;

  RETURN COALESCE(UPPER(BTRIM(v_type)) IN ('STUDENT', 'BOOTCAMP', 'TRANSIENT'), FALSE);
END;
$$;

-- On sign-in: creates or links the users row. Google with a verified email only;
-- any other sign-up gets no users row.
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT := LOWER(BTRIM(COALESCE(NEW.email, '')));
  v_provider TEXT := COALESCE(
    NEW.raw_app_meta_data->>'provider',
    NEW.raw_app_meta_data->'providers'->>0,
    ''
  );
BEGIN
  IF v_email = ''
     OR NEW.email_confirmed_at IS NULL
     OR v_provider <> 'google' THEN
    RETURN NEW;
  END IF;

  -- Link existing pre-registered user, or create new row
  IF EXISTS (SELECT 1 FROM public.users WHERE email = v_email) THEN
    UPDATE public.users
    SET auth_uids = array_append(auth_uids, NEW.id)
    WHERE email = v_email
      AND NOT (auth_uids @> ARRAY[NEW.id]);
  ELSE
    INSERT INTO public.users (id, email, auth_uids)
    VALUES (NEW.id, v_email, ARRAY[NEW.id])
    ON CONFLICT (email) DO UPDATE
    SET auth_uids = array_append(public.users.auth_uids, NEW.id)
    WHERE NOT (public.users.auth_uids @> ARRAY[NEW.id]);
  END IF;

  RETURN NEW;
END;
$$;

-- Normalizes emails to lowercase.
CREATE OR REPLACE FUNCTION normalize_email_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.email := LOWER(BTRIM(NEW.email));
  RETURN NEW;
END;
$$;

-- Ensures an auth uid is linked to at most one user.
CREATE OR REPLACE FUNCTION users_auth_uid_unique_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id <> NEW.id AND u.auth_uids && NEW.auth_uids
  ) THEN
    RAISE EXCEPTION 'auth uid is already linked to another user' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

-- evaluated may only be true for an alumni who already has an account from another
-- term. Applies to non-officer inserts made through the API.
CREATE OR REPLACE FUNCTION registrations_guard_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'authenticated' OR public.is_officer() THEN
    RETURN NEW;
  END IF;

  NEW.timestamp := NOW();
  NEW.decline_reason := NULL;

  IF COALESCE(NEW.evaluated, FALSE) AND NOT (
    UPPER(COALESCE(NEW.account_type, '')) = 'ALUMNUS'
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.resident_id = public.current_user_id()
        AND a.period IS DISTINCT FROM NEW.term
    )
  ) THEN
    NEW.evaluated := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

-- Residents may only cancel their own pending request (status and status_reason).
CREATE OR REPLACE FUNCTION payment_requests_guard_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'authenticated' OR public.is_officer() THEN
    RETURN NEW;
  END IF;

  IF OLD.status <> 'PENDING'
     OR NEW.status <> 'CANCELLED'
     OR (to_jsonb(NEW) - 'status' - 'status_reason') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'status_reason') THEN
    RAISE EXCEPTION 'Residents may only cancel their own pending payment requests' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Residents may only cancel their own active booking. cancelled_at is set here.
CREATE OR REPLACE FUNCTION laundry_guard_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client BOOLEAN := COALESCE(auth.jwt()->>'role', '') = 'authenticated' AND NOT public.is_officer();
BEGIN
  IF TG_OP = 'UPDATE' AND v_client THEN
    IF OLD.status <> 'ACTIVE'
       OR NEW.status <> 'CANCELLED'
       OR (to_jsonb(NEW) - 'status' - 'cancel_reason' - 'cancelled_at')
          IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'cancel_reason' - 'cancelled_at') THEN
      RAISE EXCEPTION 'Residents may only cancel their own active laundry bookings' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.status = 'CANCELLED' THEN
    IF TG_OP = 'INSERT' OR OLD.status <> 'CANCELLED' THEN
      NEW.cancelled_at := CASE WHEN v_client THEN NOW() ELSE COALESCE(NEW.cancelled_at, NOW()) END;
    END IF;
  ELSE
    NEW.cancelled_at := NULL;
    NEW.cancel_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. Triggers
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

CREATE TRIGGER users_normalize_email BEFORE INSERT OR UPDATE OF email ON users
  FOR EACH ROW EXECUTE FUNCTION normalize_email_trg();
CREATE TRIGGER officers_normalize_email BEFORE INSERT OR UPDATE OF email ON officers
  FOR EACH ROW EXECUTE FUNCTION normalize_email_trg();
CREATE TRIGGER registrations_normalize_email BEFORE INSERT OR UPDATE OF email ON registrations
  FOR EACH ROW EXECUTE FUNCTION normalize_email_trg();

CREATE TRIGGER users_auth_uid_unique BEFORE INSERT OR UPDATE OF auth_uids ON users
  FOR EACH ROW EXECUTE FUNCTION users_auth_uid_unique_trg();

CREATE TRIGGER registrations_guard BEFORE INSERT ON registrations
  FOR EACH ROW EXECUTE FUNCTION registrations_guard_trg();
CREATE TRIGGER payment_requests_guard BEFORE UPDATE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION payment_requests_guard_trg();
CREATE TRIGGER laundry_guard BEFORE INSERT OR UPDATE ON laundry
  FOR EACH ROW EXECUTE FUNCTION laundry_guard_trg();

-- ============================================================
-- 6. Row level security
-- ============================================================

ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE officers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal              ENABLE ROW LEVEL SECURITY;
ALTER TABLE laundry              ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE constants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridge_items         ENABLE ROW LEVEL SECURITY;

-- DML grants only; laundry rows cannot be deleted.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
REVOKE DELETE ON laundry FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON users_view, resident_directory, public_achievements, fridge_items_view FROM authenticated;
REVOKE ALL ON users_view, resident_directory, public_achievements, fridge_items_view FROM anon;
REVOKE EXECUTE ON FUNCTION get_resident_directory(), get_public_achievements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_resident_directory(), get_public_achievements() TO authenticated;

-- ── users ──────────────────────────────────────────────────
CREATE POLICY users_select ON users FOR SELECT TO authenticated
  USING ((SELECT is_officer()) OR id = (SELECT current_user_id()));
CREATE POLICY users_insert ON users FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_officer()));
CREATE POLICY users_update ON users FOR UPDATE TO authenticated
  USING ((SELECT is_officer()));
CREATE POLICY users_delete ON users FOR DELETE TO authenticated
  USING ((SELECT is_officer()));

-- ── officers ───────────────────────────────────────────────
CREATE POLICY officers_select ON officers FOR SELECT TO authenticated
  USING (true);
CREATE POLICY officers_write ON officers FOR ALL TO authenticated
  USING ((SELECT is_officer())) WITH CHECK ((SELECT is_officer()));

-- ── accounts ───────────────────────────────────────────────
CREATE POLICY accounts_select ON accounts FOR SELECT TO authenticated
  USING ((SELECT is_officer()) OR resident_id = (SELECT current_user_id()));
CREATE POLICY accounts_write ON accounts FOR ALL TO authenticated
  USING ((SELECT is_officer())) WITH CHECK ((SELECT is_officer()));

-- ── journal ────────────────────────────────────────────────
CREATE POLICY journal_select ON journal FOR SELECT TO authenticated
  USING ((SELECT is_officer()) OR account_id = (SELECT current_user_id()));
CREATE POLICY journal_write ON journal FOR ALL TO authenticated
  USING ((SELECT is_officer())) WITH CHECK ((SELECT is_officer()));

-- ── laundry ────────────────────────────────────────────────
-- Residents: book, view and cancel their own bookings.
-- Officers: full access except delete (there is intentionally no delete policy).
CREATE POLICY laundry_select ON laundry FOR SELECT TO authenticated
  USING (
    (SELECT is_officer())
    OR (resident_id = (SELECT current_user_id()) AND (SELECT can_access_laundry()))
  );
CREATE POLICY laundry_insert ON laundry FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_officer())
    OR (
      resident_id = (SELECT current_user_id())
      AND (SELECT can_access_laundry())
      AND status = 'ACTIVE'
      AND cancel_reason IS NULL
      AND cancelled_at IS NULL
    )
  );
CREATE POLICY laundry_update ON laundry FOR UPDATE TO authenticated
  USING (
    (SELECT is_officer())
    OR (resident_id = (SELECT current_user_id()) AND (SELECT can_access_laundry()) AND status = 'ACTIVE')
  )
  WITH CHECK (
    (SELECT is_officer())
    OR (resident_id = (SELECT current_user_id()) AND status = 'CANCELLED')
  );

-- ── payment_requests ───────────────────────────────────────
-- Residents: create pending requests and cancel their own pending requests.
CREATE POLICY pr_select ON payment_requests FOR SELECT TO authenticated
  USING ((SELECT is_officer()) OR resident_id = (SELECT current_user_id()));
CREATE POLICY pr_insert ON payment_requests FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_officer())
    OR (resident_id = (SELECT current_user_id()) AND status = 'PENDING' AND status_reason IS NULL)
  );
CREATE POLICY pr_update ON payment_requests FOR UPDATE TO authenticated
  USING (
    (SELECT is_officer())
    OR (resident_id = (SELECT current_user_id()) AND status = 'PENDING')
  )
  WITH CHECK (
    (SELECT is_officer())
    OR (resident_id = (SELECT current_user_id()) AND status = 'CANCELLED')
  );
CREATE POLICY pr_delete ON payment_requests FOR DELETE TO authenticated
  USING ((SELECT is_officer()));

-- ── announcements ──────────────────────────────────────────
CREATE POLICY announcements_select ON announcements FOR SELECT TO authenticated
  USING ((SELECT is_officer()) OR (is_admin_only = FALSE AND is_unlisted = FALSE));
CREATE POLICY announcements_write ON announcements FOR ALL TO authenticated
  USING ((SELECT is_officer())) WITH CHECK ((SELECT is_officer()));

-- ── user_settings ──────────────────────────────────────────
CREATE POLICY settings_select ON user_settings FOR SELECT TO authenticated
  USING ((SELECT is_officer()) OR resident_id = (SELECT current_user_id()));
CREATE POLICY settings_insert ON user_settings FOR INSERT TO authenticated
  WITH CHECK (resident_id = (SELECT current_user_id()) OR (SELECT is_officer()));
CREATE POLICY settings_update ON user_settings FOR UPDATE TO authenticated
  USING (resident_id = (SELECT current_user_id()) OR (SELECT is_officer()));

-- ── achievements ───────────────────────────────────────────
CREATE POLICY achievements_select ON achievements FOR SELECT TO authenticated
  USING (true);
CREATE POLICY achievements_write ON achievements FOR ALL TO authenticated
  USING ((SELECT is_officer())) WITH CHECK ((SELECT is_officer()));

-- ── achievement_records ────────────────────────────────────
CREATE POLICY ach_records_select ON achievement_records FOR SELECT TO authenticated
  USING ((SELECT is_officer()) OR account_id = (SELECT current_user_id()));  -- Everyone else uses public_achievements
CREATE POLICY ach_records_write ON achievement_records FOR ALL TO authenticated
  USING ((SELECT is_officer())) WITH CHECK ((SELECT is_officer()));

-- ── constants ──────────────────────────────────────────────
CREATE POLICY constants_select ON constants FOR SELECT TO authenticated
  USING (true);
CREATE POLICY constants_write ON constants FOR ALL TO authenticated
  USING ((SELECT is_officer())) WITH CHECK ((SELECT is_officer()));

-- ── registrations ──────────────────────────────────────────
CREATE POLICY registrations_select ON registrations FOR SELECT TO authenticated
  USING ((SELECT is_officer()) OR email = (SELECT LOWER(BTRIM(COALESCE(auth.jwt()->>'email', '')))));
CREATE POLICY registrations_insert ON registrations FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_officer()) OR email = (SELECT LOWER(BTRIM(COALESCE(auth.jwt()->>'email', '')))));
CREATE POLICY registrations_update ON registrations FOR UPDATE TO authenticated
  USING ((SELECT is_officer())) WITH CHECK ((SELECT is_officer()));
CREATE POLICY registrations_delete ON registrations FOR DELETE TO authenticated
  USING ((SELECT is_officer()));

-- ── fridge_items ───────────────────────────────────────────
CREATE POLICY fridge_items_select ON fridge_items FOR SELECT TO authenticated
  USING (true);
CREATE POLICY fridge_items_insert ON fridge_items FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_officer()) OR resident_id = (SELECT current_user_id()));
CREATE POLICY fridge_items_update ON fridge_items FOR UPDATE TO authenticated
  USING ((SELECT is_officer()) OR resident_id = (SELECT current_user_id()));
CREATE POLICY fridge_items_delete ON fridge_items FOR DELETE TO authenticated
  USING ((SELECT is_officer()) OR resident_id = (SELECT current_user_id()));
