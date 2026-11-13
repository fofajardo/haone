-- Create normalized terms table
CREATE TABLE IF NOT EXISTS public.terms (
  term_id INTEGER PRIMARY KEY,
  term TEXT NOT NULL,
  ay TEXT NOT NULL,
  term_type TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read terms"
  ON public.terms FOR SELECT
  USING (true);

CREATE POLICY "Officers can insert terms"
  ON public.terms FOR INSERT
  WITH CHECK (public.is_officer());

CREATE POLICY "Officers can update terms"
  ON public.terms FOR UPDATE
  USING (public.is_officer())
  WITH CHECK (public.is_officer());

CREATE POLICY "Officers can delete terms"
  ON public.terms FOR DELETE
  USING (public.is_officer());

-- Create normalized fee_schedule table
CREATE TABLE IF NOT EXISTS public.fee_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id INTEGER NOT NULL REFERENCES public.terms(term_id) ON DELETE CASCADE,
  fee_code_id UUID NOT NULL REFERENCES public.fee_codes(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  collection_periods INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (term_id, fee_code_id)
);

ALTER TABLE public.fee_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read fee_schedule"
  ON public.fee_schedule FOR SELECT
  USING (true);

CREATE POLICY "Officers can insert fee_schedule"
  ON public.fee_schedule FOR INSERT
  WITH CHECK (public.is_officer());

CREATE POLICY "Officers can update fee_schedule"
  ON public.fee_schedule FOR UPDATE
  USING (public.is_officer())
  WITH CHECK (public.is_officer());

CREATE POLICY "Officers can delete fee_schedule"
  ON public.fee_schedule FOR DELETE
  USING (public.is_officer());

-- Clean up migrated term/fee keys from constants
DELETE FROM public.constants
WHERE key = 'TERM_CURR'
   OR key LIKE 'TERM_%'
   OR key LIKE 'FEES_%';
