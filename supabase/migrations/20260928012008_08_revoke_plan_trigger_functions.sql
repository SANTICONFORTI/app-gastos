-- Trigger functions are never meant to be called through the API.
revoke execute on function public.installment_plans_log_history() from public, anon, authenticated;
revoke execute on function public.installment_plans_before_insert() from public, anon, authenticated;
revoke execute on function public.installment_plans_before_update() from public, anon, authenticated;
revoke execute on function public.expenses_protect_installments() from public, anon, authenticated;
