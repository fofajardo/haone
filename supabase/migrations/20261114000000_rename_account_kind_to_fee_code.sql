-- Rename journal.account_kind to journal.fee_code

ALTER TABLE journal
  RENAME COLUMN account_kind TO fee_code;

ALTER TABLE journal
  RENAME CONSTRAINT journal_account_kind_chk TO journal_fee_code_chk;

ALTER INDEX journal_account_kind_idx
  RENAME TO journal_fee_code_idx;
