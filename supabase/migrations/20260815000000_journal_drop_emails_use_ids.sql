-- 003: Update journal schema to drop legacy email columns and use UUIDs / IDs

-- ── 1. Column Migration ──────────────────────────────────────
DO $$
BEGIN
  -- Add creator_id if not present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal' AND column_name = 'creator_id'
  ) THEN
    ALTER TABLE public.journal ADD COLUMN creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  -- Add account_id if not present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.journal ADD COLUMN account_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Populate creator_id / account_id from legacy email columns if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal' AND column_name = 'creator_email'
  ) THEN
    -- Try direct uuid match or email join
    UPDATE public.journal j
    SET creator_id = u.id
    FROM public.users u
    WHERE j.creator_id IS NULL AND (
      j.creator_email = u.id::text OR 
      LOWER(j.creator_email) = LOWER(u.email)
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal' AND column_name = 'account_email'
  ) THEN
    -- Try direct uuid match, email join, or student_no join
    UPDATE public.journal j
    SET account_id = u.id
    FROM public.users u
    WHERE j.account_id IS NULL AND (
      j.account_email = u.id::text OR 
      LOWER(j.account_email) = LOWER(u.email) OR
      (u.student_no IS NOT NULL AND u.student_no <> '' AND LOWER(j.account_email) = LOWER(u.student_no))
    );
  END IF;
END $$;

-- ── 2. Drop dependent RLS policies before dropping columns ───
DROP POLICY IF EXISTS "journal_select" ON public.journal;
DROP POLICY IF EXISTS journal_select ON public.journal;
DROP POLICY IF EXISTS "journal_write" ON public.journal;
DROP POLICY IF EXISTS journal_write ON public.journal;

-- Drop legacy email columns
ALTER TABLE public.journal DROP COLUMN IF EXISTS creator_email CASCADE;
ALTER TABLE public.journal DROP COLUMN IF EXISTS account_email CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS journal_account_id_idx ON public.journal(account_id);
CREATE INDEX IF NOT EXISTS journal_creator_id_idx ON public.journal(creator_id);

-- ── 3. Create updated Journal RLS Policies ───────────────────
CREATE POLICY journal_select ON public.journal FOR SELECT TO authenticated
  USING (
    is_officer() OR 
    account_id = current_user_id()
  );

CREATE POLICY journal_write ON public.journal FOR ALL TO authenticated
  USING (is_officer()) 
  WITH CHECK (is_officer());
