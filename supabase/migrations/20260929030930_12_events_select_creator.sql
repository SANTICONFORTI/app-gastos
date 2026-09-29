-- INSERT ... RETURNING checks the SELECT policy against the new row, which the helper
-- (a separate query) can't see yet. Let the creator see it directly, like groups do.
drop policy "Ver eventos donde participo, de mis grupos o que creé" on public.events;
create policy "Ver eventos donde participo, de mis grupos o que creé" on public.events
  for select to authenticated
  using (created_by = (select auth.uid()) or private.can_see_event(id));
