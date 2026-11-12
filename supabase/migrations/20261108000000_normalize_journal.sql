-- Normalize journal table: replace water, assoc, misc columns with
-- group_id (UUID), account_kind (SMALLINT: 1=WATER, 2=ASSOC, 3=MISC), and value (NUMERIC).

ALTER TABLE journal
  ADD COLUMN group_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN account_kind SMALLINT,
  ADD COLUMN value NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Preserve existing rows under their original id as group_id
UPDATE journal SET group_id = id;

-- Split rows that have assoc != 0 when water != 0 into additional rows
INSERT INTO journal (
  id, group_id, date, creator_id, account_id, account_kind, value,
  mop, period, type, notes, notes_private, mop_ref_no,
  pr_date_issued, pr_ref_no, was_audited, receipt_url, created_at
)
SELECT
  gen_random_uuid(), group_id, date, creator_id, account_id, 2, COALESCE(assoc, 0),
  mop, period, type, notes, notes_private, mop_ref_no,
  pr_date_issued, pr_ref_no, was_audited, receipt_url, created_at
FROM journal
WHERE COALESCE(water, 0) <> 0
  AND COALESCE(assoc, 0) <> 0;

-- Split rows that have misc != 0 when water != 0 or assoc != 0 into additional rows
INSERT INTO journal (
  id, group_id, date, creator_id, account_id, account_kind, value,
  mop, period, type, notes, notes_private, mop_ref_no,
  pr_date_issued, pr_ref_no, was_audited, receipt_url, created_at
)
SELECT
  gen_random_uuid(), group_id, date, creator_id, account_id, 3, COALESCE(misc, 0),
  mop, period, type, notes, notes_private, mop_ref_no,
  pr_date_issued, pr_ref_no, was_audited, receipt_url, created_at
FROM journal
WHERE account_kind IS NULL
  AND (COALESCE(water, 0) <> 0 OR COALESCE(assoc, 0) <> 0)
  AND COALESCE(misc, 0) <> 0;

-- Update primary row for each group with its primary fee component
UPDATE journal
SET
  account_kind = CASE
    WHEN COALESCE(water, 0) <> 0 THEN 1
    WHEN COALESCE(assoc, 0) <> 0 THEN 2
    WHEN COALESCE(misc, 0) <> 0 THEN 3
    ELSE 1
  END,
  value = CASE
    WHEN COALESCE(water, 0) <> 0 THEN COALESCE(water, 0)
    WHEN COALESCE(assoc, 0) <> 0 THEN COALESCE(assoc, 0)
    WHEN COALESCE(misc, 0) <> 0 THEN COALESCE(misc, 0)
    ELSE 0
  END
WHERE account_kind IS NULL;

ALTER TABLE journal
  ALTER COLUMN account_kind SET NOT NULL,
  ADD CONSTRAINT journal_account_kind_chk CHECK (account_kind IN (1, 2, 3)),
  DROP COLUMN water,
  DROP COLUMN assoc,
  DROP COLUMN misc;

CREATE INDEX journal_group_id_idx ON journal (group_id);
CREATE INDEX journal_account_kind_idx ON journal (account_kind);
