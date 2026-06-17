-- Fix do loop de login (erro 403 / 42501) apos o hardening de RLS.
--
-- As policies multi-tenant chamam funcoes helper (get_user_company_id, etc.).
-- O papel 'authenticated' nao tinha EXECUTE em algumas delas; enquanto existiam
-- as policies permissivas "anyone can ... USING(true)", o planner curto-
-- circuitava o OR e nunca avaliava essas funcoes. Removidas as policies
-- permissivas (migration 20260616180000), a avaliacao do qual passou a chamar
-- as funcoes e retornava "42501: permission denied for function ..." -> 403 ->
-- login voltava silenciosamente para a tela de login.
--
-- As funcoes sao SECURITY DEFINER e so retornam dados do proprio usuario
-- (via auth.uid()), portanto conceder EXECUTE ao authenticated e seguro e e o
-- que faz o isolamento por clinica realmente funcionar (antes ele so "passava"
-- porque tudo estava liberado pelo USING(true)).
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_company_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) TO authenticated;
