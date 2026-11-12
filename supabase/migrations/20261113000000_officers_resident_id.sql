-- Normalize officers table to reference users(id) via resident_id instead of email.

-- 1. Drop email-based trigger and index on officers
DROP TRIGGER IF EXISTS officers_normalize_email ON officers;
DROP INDEX IF EXISTS officers_email_idx;

-- 2. Add resident_id column and backfill from users.email
ALTER TABLE officers
  ADD COLUMN resident_id UUID REFERENCES users(id) ON DELETE CASCADE;

UPDATE officers o
SET resident_id = u.id
FROM users u
WHERE LOWER(BTRIM(o.email)) = LOWER(BTRIM(u.email));

-- Remove any orphaned officer rows that do not match a user
DELETE FROM officers WHERE resident_id IS NULL;

ALTER TABLE officers
  ALTER COLUMN resident_id SET NOT NULL,
  DROP COLUMN email;

-- 3. Update status check constraint to match OfficerStatus enum
ALTER TABLE officers
  DROP CONSTRAINT IF EXISTS officers_status_chk,
  ADD CONSTRAINT officers_status_chk CHECK (status IN ('ACTIVE', 'INACTIVE', 'RESIGNED', 'CHANGED_POSITION'));

CREATE INDEX officers_resident_id_idx ON officers (resident_id);

-- 4. Update is_officer() to match through officers.resident_id
CREATE OR REPLACE FUNCTION is_officer()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.officers o
    WHERE o.resident_id = public.current_user_id()
      AND UPPER(BTRIM(COALESCE(o.status, ''))) = 'ACTIVE'
  );
$$;
