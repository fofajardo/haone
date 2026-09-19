-- 004: Enforce laundry access restrictions via RLS

CREATE OR REPLACE FUNCTION can_access_laundry(user_uuid UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_term TEXT;
  v_type TEXT;
BEGIN
  SELECT value INTO v_term FROM public.constants WHERE key = 'TERM_CURR' LIMIT 1;
  IF v_term IS NULL THEN
    v_term := '';
  END IF;

  SELECT UPPER(TRIM(COALESCE(type, ''))) INTO v_type
  FROM public.accounts
  WHERE resident_id = user_uuid AND period = v_term
  LIMIT 1;

  IF v_type IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_type IN ('STUDENT', 'BOOTCAMP', 'TRANSIENT');
END;
$$;

-- Update RLS policies on laundry table
DROP POLICY IF EXISTS laundry_select ON laundry;
CREATE POLICY laundry_select ON laundry FOR SELECT TO authenticated
  USING (is_officer() OR (resident_id = current_user_id() AND can_access_laundry(current_user_id())));

DROP POLICY IF EXISTS laundry_insert ON laundry;
CREATE POLICY laundry_insert ON laundry FOR INSERT TO authenticated
  WITH CHECK (is_officer() OR (resident_id = current_user_id() AND can_access_laundry(current_user_id())));

DROP POLICY IF EXISTS laundry_update ON laundry;
CREATE POLICY laundry_update ON laundry FOR UPDATE TO authenticated
  USING (is_officer() OR (resident_id = current_user_id() AND can_access_laundry(current_user_id())));

DROP POLICY IF EXISTS laundry_delete ON laundry;
CREATE POLICY laundry_delete ON laundry FOR DELETE TO authenticated
  USING (is_officer() OR (resident_id = current_user_id() AND can_access_laundry(current_user_id())));
