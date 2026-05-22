
CREATE OR REPLACE FUNCTION public.next_prontuario()
RETURNS text
LANGUAGE sql
SET search_path = public
AS $$
  SELECT 'PRONT-' || lpad(nextval('public.prontuario_seq')::text, 5, '0');
$$;
