-- Security advisor (0029): RLS helper functions were callable through /rest/v1/rpc.
-- Move them to a schema the API doesn't expose. Policies reference functions by OID,
-- so every existing policy (tables and storage) keeps working unchanged.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.has_group_access(uuid) set schema private;
alter function public.is_group_admin(uuid) set schema private;
alter function public.is_group_member(uuid) set schema private;
alter function public.is_user_in_group(uuid, uuid) set schema private;

revoke execute on function private.has_group_access(uuid) from public, anon;
revoke execute on function private.is_group_admin(uuid) from public, anon;
revoke execute on function private.is_group_member(uuid) from public, anon;
revoke execute on function private.is_user_in_group(uuid, uuid) from public, anon;
grant execute on function private.has_group_access(uuid) to authenticated;
grant execute on function private.is_group_admin(uuid) to authenticated;
grant execute on function private.is_group_member(uuid) to authenticated;
grant execute on function private.is_user_in_group(uuid, uuid) to authenticated;

-- Intended RPCs for the app: signed-in users only.
revoke execute on function public.join_group_with_code(text) from public, anon;
revoke execute on function public.preview_invite(text) from public, anon;
revoke execute on function public.respond_group_invite(uuid, boolean) from public, anon;
grant execute on function public.join_group_with_code(text) to authenticated;
grant execute on function public.preview_invite(text) to authenticated;
grant execute on function public.respond_group_invite(uuid, boolean) to authenticated;
