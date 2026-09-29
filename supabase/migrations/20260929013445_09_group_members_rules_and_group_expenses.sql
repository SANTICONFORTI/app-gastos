-- 1) Membership rules enforced in the database.
--    Direct API updates (role "authenticated", i.e. admins through RLS) may only:
--    approve/reject requests, remove members, re-invite removed people, cancel invitations
--    and change roles of active members. Joining/accepting happens through the
--    security definer RPCs (they run as the table owner, not as "authenticated").
--    A group can never be left without an active admin.

create function public.group_members_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.group_id is distinct from old.group_id or new.user_id is distinct from old.user_id then
    raise exception 'No se puede mover a un integrante de grupo';
  end if;

  if current_user = 'authenticated' then
    if new.status is distinct from old.status and not (
         (old.status = 'pending' and new.status in ('active', 'removed'))
      or (old.status = 'active' and new.status = 'removed')
      or (old.status = 'removed' and new.status = 'invited')
      or (old.status = 'invited' and new.status = 'removed')
    ) then
      raise exception 'Ese cambio de estado no está permitido';
    end if;
    if new.role is distinct from old.role and old.status <> 'active' then
      raise exception 'Solo se puede cambiar el rol de integrantes activos';
    end if;
  end if;

  if new.status <> 'active' then
    new.role := 'member';
  end if;

  if old.role = 'admin' and old.status = 'active'
     and (new.role <> 'admin' or new.status <> 'active')
     and not exists (
       select 1 from public.group_members m
       where m.group_id = old.group_id and m.user_id <> old.user_id
         and m.role = 'admin' and m.status = 'active'
     )
     and exists (
       select 1 from public.group_members m
       where m.group_id = old.group_id and m.user_id <> old.user_id and m.status = 'active'
     ) then
    raise exception 'El grupo tiene que tener al menos un admin. Nombrá a otro admin primero.';
  end if;

  if new.status = 'active' and old.status <> 'active' then
    new.joined_at := now();
  end if;
  return new;
end $$;

create trigger group_members_guard before update on public.group_members
  for each row execute function public.group_members_guard();

revoke execute on function public.group_members_guard() from public, anon, authenticated;

-- Leave a group (any member). The last admin must name another admin first,
-- unless nobody else is left.
create function public.leave_group(gid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión';
  end if;
  update public.group_members
     set status = 'removed'
   where group_id = gid and user_id = auth.uid() and status in ('active', 'pending', 'invited');
  if not found then
    raise exception 'No estás en ese grupo';
  end if;
end $$;

revoke execute on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;

-- 2) Group expenses: the expense and its split are saved together.
--    split_snapshot copies the split into the expense row, so the automatic history
--    (to_jsonb of the row) also records how it was split before and after each edit.

alter table public.expenses add column split_snapshot jsonb;

create function public.save_group_expense(
  p_expense_id uuid,
  p_group_id uuid,
  p_paid_by uuid,
  p_amount numeric,
  p_currency text,
  p_exchange_rate numeric,
  p_rate_type text,
  p_category_id uuid,
  p_note text,
  p_spent_at timestamptz,
  p_receipt_path text,
  p_splits jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_sum numeric;
  v_count int;
  v_distinct int;
  v_snapshot jsonb;
begin
  if not private.is_group_admin(p_group_id) then
    raise exception 'Solo los admins del grupo pueden cargar o editar gastos';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto tiene que ser mayor a cero';
  end if;
  if not private.is_user_in_group(p_group_id, p_paid_by) then
    raise exception 'Quien pagó tiene que ser integrante del grupo';
  end if;
  if p_splits is null or jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'Elegí entre quiénes se divide el gasto';
  end if;

  select coalesce(sum(round((s->>'amount')::numeric, 2)), 0), count(*), count(distinct s->>'user_id')
    into v_sum, v_count, v_distinct
    from jsonb_array_elements(p_splits) s;
  if v_count <> v_distinct then
    raise exception 'Hay una persona repetida en la división';
  end if;
  if abs(v_sum - round(p_amount, 2)) > 0.001 then
    raise exception 'La división no suma el total del gasto';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_splits) s
    where (s->>'amount')::numeric < 0
       or not private.is_user_in_group(p_group_id, (s->>'user_id')::uuid)
  ) then
    raise exception 'La división incluye a alguien que no está en el grupo';
  end if;

  select jsonb_agg(jsonb_build_object('user_id', s->>'user_id', 'amount', round((s->>'amount')::numeric, 2))
                   order by s->>'user_id')
    into v_snapshot
    from jsonb_array_elements(p_splits) s;

  if p_expense_id is null then
    insert into public.expenses (
      group_id, paid_by, amount, currency, exchange_rate, rate_type,
      category_id, note, spent_at, receipt_path, split_snapshot
    ) values (
      p_group_id, p_paid_by, round(p_amount, 2), p_currency, p_exchange_rate, p_rate_type,
      p_category_id, nullif(trim(p_note), ''), coalesce(p_spent_at, now()), p_receipt_path, v_snapshot
    ) returning id into v_id;
  else
    update public.expenses
       set paid_by = p_paid_by,
           amount = round(p_amount, 2),
           currency = p_currency,
           exchange_rate = p_exchange_rate,
           rate_type = p_rate_type,
           category_id = p_category_id,
           note = nullif(trim(p_note), ''),
           spent_at = coalesce(p_spent_at, spent_at),
           receipt_path = coalesce(receipt_path, p_receipt_path), -- receipts are never replaced
           split_snapshot = v_snapshot
     where id = p_expense_id and group_id = p_group_id
    returning id into v_id;
    if v_id is null then
      raise exception 'No encontramos ese gasto en el grupo';
    end if;
    delete from public.expense_splits where expense_id = v_id;
  end if;

  insert into public.expense_splits (expense_id, user_id, amount)
  select v_id, (s->>'user_id')::uuid, round((s->>'amount')::numeric, 2)
    from jsonb_array_elements(p_splits) s;

  return v_id;
end $$;

revoke execute on function public.save_group_expense(uuid, uuid, uuid, numeric, text, numeric, text, uuid, text, timestamptz, text, jsonb) from public, anon;
grant execute on function public.save_group_expense(uuid, uuid, uuid, numeric, text, numeric, text, uuid, text, timestamptz, text, jsonb) to authenticated;
