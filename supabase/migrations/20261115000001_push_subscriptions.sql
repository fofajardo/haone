-- Create push_subscriptions table (replaces Firestore push_subscriptions collection)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL DEFAULT '',
  auth TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_resident_id
  ON public.push_subscriptions (resident_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
