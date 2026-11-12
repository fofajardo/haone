-- Normalize journal into journal_groups (transaction header), journal (line items),
-- and acknowledgment_receipts (receipt metadata).

-- 1. Create journal_groups parent table to hold transaction-level attributes
CREATE TABLE journal_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  account_id UUID REFERENCES users(id) ON DELETE SET NULL,
  mop TEXT,
  period TEXT,
  type TEXT,
  notes TEXT,
  notes_private TEXT,
  mop_ref_no TEXT,
  was_audited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX journal_groups_account_id_idx ON journal_groups (account_id);
CREATE INDEX journal_groups_creator_id_idx ON journal_groups (creator_id);
CREATE INDEX journal_groups_period_idx     ON journal_groups (period);

-- Populate journal_groups from existing journal rows
INSERT INTO journal_groups (
  id, date, creator_id, account_id, mop, period, type,
  notes, notes_private, mop_ref_no, was_audited, created_at
)
SELECT DISTINCT ON (group_id)
  group_id,
  date,
  creator_id,
  account_id,
  mop,
  period,
  type,
  notes,
  notes_private,
  mop_ref_no,
  COALESCE(was_audited, FALSE),
  created_at
FROM journal
ORDER BY group_id, created_at ASC
ON CONFLICT (id) DO NOTHING;

-- Attach FK from journal.group_id to journal_groups.id
ALTER TABLE journal
  ADD CONSTRAINT journal_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES journal_groups(id) ON DELETE CASCADE;

-- Automatically clean up orphaned journal_groups when all journal line items in a group are deleted
CREATE OR REPLACE FUNCTION cleanup_journal_group_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.journal WHERE group_id = OLD.group_id) THEN
    DELETE FROM public.journal_groups WHERE id = OLD.group_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER journal_cleanup_group
  AFTER DELETE ON journal
  FOR EACH ROW EXECUTE FUNCTION cleanup_journal_group_trg();

-- 2. Create acknowledgment_receipts table
CREATE TABLE acknowledgment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL UNIQUE REFERENCES journal_groups(id) ON DELETE CASCADE,
  date_issued DATE,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX acknowledgment_receipts_group_id_idx ON acknowledgment_receipts (group_id);

-- Migrate existing receipt data from journal into acknowledgment_receipts
INSERT INTO acknowledgment_receipts (id, group_id, date_issued, receipt_url, created_at)
SELECT
  CASE
    WHEN BTRIM(COALESCE(sub.pr_ref_no, '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN BTRIM(sub.pr_ref_no)::UUID
    ELSE gen_random_uuid()
  END AS id,
  sub.group_id,
  sub.pr_date_issued,
  NULLIF(BTRIM(COALESCE(sub.receipt_url, '')), ''),
  sub.created_at
FROM (
  SELECT DISTINCT ON (group_id)
    group_id,
    pr_ref_no,
    pr_date_issued,
    receipt_url,
    created_at
  FROM journal
  WHERE
    (pr_ref_no IS NOT NULL AND BTRIM(pr_ref_no) NOT IN ('', 'N/A', '#N/A'))
    OR pr_date_issued IS NOT NULL
    OR (receipt_url IS NOT NULL AND BTRIM(receipt_url) NOT IN ('', 'N/A', '#N/A'))
    OR (
      BTRIM(COALESCE(pr_ref_no, '')) NOT IN ('N/A', '#N/A')
      AND (
        type IN ('COLLECTION', 'WAIVED')
        OR (
          type IN ('COLLECTION_OTHERS', 'REFUND', 'REFUND_COLLECTION')
          AND account_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001'::UUID
        )
      )
    )
  ORDER BY group_id, created_at ASC
) sub
ON CONFLICT (group_id) DO NOTHING;

-- 3. Drop old journal_select policy before dropping account_id from journal
DROP POLICY IF EXISTS journal_select ON journal;

-- 4. Drop migrated header and receipt columns from journal
ALTER TABLE journal
  DROP COLUMN date,
  DROP COLUMN creator_id,
  DROP COLUMN account_id,
  DROP COLUMN mop,
  DROP COLUMN period,
  DROP COLUMN type,
  DROP COLUMN notes,
  DROP COLUMN notes_private,
  DROP COLUMN mop_ref_no,
  DROP COLUMN pr_date_issued,
  DROP COLUMN pr_ref_no,
  DROP COLUMN was_audited,
  DROP COLUMN receipt_url;

-- 5. Enable RLS and configure policies
ALTER TABLE journal_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE acknowledgment_receipts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON journal_groups, acknowledgment_receipts TO authenticated;

CREATE POLICY journal_groups_select ON journal_groups FOR SELECT TO authenticated
  USING ((SELECT is_officer()) OR account_id = (SELECT current_user_id()));
CREATE POLICY journal_groups_write ON journal_groups FOR ALL TO authenticated
  USING ((SELECT is_officer())) WITH CHECK ((SELECT is_officer()));

CREATE POLICY journal_select ON journal FOR SELECT TO authenticated
  USING (
    (SELECT is_officer())
    OR EXISTS (
      SELECT 1 FROM public.journal_groups g
      WHERE g.id = journal.group_id
        AND g.account_id = (SELECT current_user_id())
    )
  );

CREATE POLICY acknowledgment_receipts_select ON acknowledgment_receipts FOR SELECT TO authenticated
  USING (
    (SELECT is_officer())
    OR EXISTS (
      SELECT 1 FROM public.journal_groups g
      WHERE g.id = acknowledgment_receipts.group_id
        AND g.account_id = (SELECT current_user_id())
    )
  );
CREATE POLICY acknowledgment_receipts_write ON acknowledgment_receipts FOR ALL TO authenticated
  USING ((SELECT is_officer())) WITH CHECK ((SELECT is_officer()));
