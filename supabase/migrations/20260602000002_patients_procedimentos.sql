ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS procedimentos TEXT[] DEFAULT '{}';
