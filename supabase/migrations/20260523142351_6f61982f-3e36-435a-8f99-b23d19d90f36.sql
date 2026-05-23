ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS email text;

CREATE POLICY "anyone can delete"
ON public.patients
FOR DELETE
TO anon, authenticated
USING (true);