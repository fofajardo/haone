-- Create fee_codes configuration table (replaces static FEE_CODE_CONFIG)
CREATE TABLE IF NOT EXISTS public.fee_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  short_label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  can_waive BOOLEAN NOT NULL DEFAULT false,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  payment_request_field TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read fee_codes"
  ON public.fee_codes FOR SELECT
  USING (true);

CREATE POLICY "Officers can insert fee_codes"
  ON public.fee_codes FOR INSERT
  WITH CHECK (public.is_officer());

CREATE POLICY "Officers can update fee_codes"
  ON public.fee_codes FOR UPDATE
  USING (public.is_officer())
  WITH CHECK (public.is_officer());

CREATE POLICY "Officers can delete fee_codes"
  ON public.fee_codes FOR DELETE
  USING (public.is_officer());

-- Initialize default fee codes if they do not exist
INSERT INTO public.fee_codes (
  label, short_label, color, can_waive, is_mandatory, payment_request_field, sort_order
) VALUES
  ('Water Fee', 'Water', '#06b6d4', true, true, 'waterFee', 0),
  ('Association Fee', 'Association', '#3b82f6', true, true, 'assocFee', 1),
  ('Miscellaneous', 'Misc', '#f59e0b', false, false, 'misc', 2)
ON CONFLICT (label) DO NOTHING;

-- Migrate journal_items.fee_code from SMALLINT to UUID referencing fee_codes(id)
ALTER TABLE public.journal
  ADD COLUMN IF NOT EXISTS fee_code_id UUID REFERENCES public.fee_codes(id) ON DELETE RESTRICT;

UPDATE public.journal ji
SET fee_code_id = fc.id
FROM public.fee_codes fc
WHERE (ji.fee_code = 0 AND fc.label = 'Water Fee')
   OR (ji.fee_code = 1 AND fc.label = 'Association Fee')
   OR (ji.fee_code = 2 AND fc.label = 'Miscellaneous');

ALTER TABLE public.journal
  DROP COLUMN fee_code;

ALTER TABLE public.journal
  RENAME COLUMN fee_code_id TO fee_code;

ALTER TABLE public.journal
  ALTER COLUMN fee_code SET NOT NULL;
