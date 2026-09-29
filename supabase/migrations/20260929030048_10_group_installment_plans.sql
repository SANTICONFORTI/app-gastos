-- Group purchases in installments: admins create them; each installment is a group expense
-- with its own split (proportional to how the total was split).

alter table public.installment_plans
  add column paid_by uuid references public.profiles(id),
  add column split_snapshot jsonb;

create index installment_plans_paid_by_idx on public.installment_plans(paid_by);

create policy "Admins cargan compras en cuotas del grupo" on public.installment_plans
  for insert to authenticated
  with check (group_id is not null and owner_id is null and private.is_group_admin(group_id));

create policy "Admins editan o anulan compras en cuotas del grupo" on public.installment_plans
  for update to authenticated
  using (group_id is not null and private.is_group_admin(group_id))
  with check (group_id is not null and private.is_group_admin(group_id));

-- Who paid and how it was split can't change after creating the purchase either.
create or replace function public.installment_plans_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'voided' then
    raise exception 'Una compra anulada no se puede modificar';
  end if;
  if new.owner_id is distinct from old.owner_id
     or new.group_id is distinct from old.group_id
     or new.total_amount is distinct from old.total_amount
     or new.installment_count is distinct from old.installment_count
     or new.first_month is distinct from old.first_month
     or new.currency is distinct from old.currency
     or new.exchange_rate is distinct from old.exchange_rate
     or new.rate_type is distinct from old.rate_type
     or new.purchased_at is distinct from old.purchased_at
     or new.receipt_path is distinct from old.receipt_path
     or new.paid_by is distinct from old.paid_by
     or new.split_snapshot is distinct from old.split_snapshot
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Para cambiar montos, cuotas o la división, anulá la compra y cargala de nuevo';
  end if;
  if new.status = 'voided' then
    if coalesce(trim(new.void_reason), '') = '' then
      raise exception 'El motivo de la anulación es obligatorio';
    end if;
    new.voided_by := auth.uid();
    new.voided_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

revoke execute on function public.installment_plans_before_update() from public, anon, authenticated;

create function public.create_group_installment_plan(
  p_group_id uuid,
  p_paid_by uuid,
  p_total_amount numeric,
  p_installment_count int,
  p_first_month date,
  p_purchased_at timestamptz,
  p_currency text,
  p_exchange_rate numeric,
  p_rate_type text,
  p_category_id uuid,
  p_note text,
  p_card text,
  p_receipt_path text,
  p_splits jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_local timestamp := p_purchased_at at time zone v_tz;
  v_first date := date_trunc('month', p_first_month)::date;
  v_total_cents bigint;
  v_base bigint;
  v_amount bigint;
  v_month date;
  v_day int;
  v_note text := nullif(trim(p_note), '');
  v_plan_id uuid;
  v_expense_id uuid;
  v_snapshot jsonb;
  v_sum bigint;
  v_count int;
  v_distinct int;
begin
  if not private.is_group_admin(p_group_id) then
    raise exception 'Solo los admins del grupo pueden cargar gastos';
  end if;
  if p_installment_count is null or p_installment_count < 2 or p_installment_count > 60 then
    raise exception 'Elegí entre 2 y 60 cuotas';
  end if;
  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'El monto tiene que ser mayor a cero';
  end if;
  if not private.is_user_in_group(p_group_id, p_paid_by) then
    raise exception 'Quien pagó tiene que ser integrante del grupo';
  end if;
  if p_splits is null or jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'Elegí entre quiénes se divide el gasto';
  end if;

  v_total_cents := round(p_total_amount * 100);
  select coalesce(sum(round((s->>'amount')::numeric * 100)), 0), count(*), count(distinct s->>'user_id')
    into v_sum, v_count, v_distinct
    from jsonb_array_elements(p_splits) s;
  if v_count <> v_distinct then
    raise exception 'Hay una persona repetida en la división';
  end if;
  if v_sum <> v_total_cents then
    raise exception 'La división no suma el total del gasto';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_splits) s
    where (s->>'amount')::numeric < 0
       or not private.is_user_in_group(p_group_id, (s->>'user_id')::uuid)
  ) then
    raise exception 'La división incluye a alguien que no está en el grupo';
  end if;

  insert into public.installment_plans (
    group_id, paid_by, total_amount, installment_count, first_month, card, currency,
    exchange_rate, rate_type, category_id, note, receipt_path, purchased_at, split_snapshot
  ) values (
    p_group_id, p_paid_by, v_total_cents / 100.0, p_installment_count, v_first, nullif(trim(p_card), ''), p_currency,
    p_exchange_rate, p_rate_type, p_category_id, v_note, p_receipt_path, p_purchased_at,
    (select jsonb_agg(jsonb_build_object('user_id', s->>'user_id', 'amount', round((s->>'amount')::numeric, 2)) order by s->>'user_id')
       from jsonb_array_elements(p_splits) s)
  ) returning id into v_plan_id;

  v_base := v_total_cents / p_installment_count;

  for i in 1..p_installment_count loop
    v_amount := case when i = p_installment_count
      then v_total_cents - v_base * (p_installment_count - 1) else v_base end;

    -- Each person's part of this installment, proportional to their part of the total;
    -- leftover cents go one by one to the first people (ordered by id).
    with shares as (
      select (s->>'user_id')::uuid as uid,
             round((s->>'amount')::numeric * 100)::bigint as cents,
             row_number() over (order by s->>'user_id') as rn
        from jsonb_array_elements(p_splits) s
    ), parts as (
      select uid, rn, (v_amount * cents) / v_total_cents as part from shares
    ), rest as (
      select v_amount - sum(part) as r from parts
    )
    select jsonb_agg(jsonb_build_object(
             'user_id', uid,
             'amount', (part + case when rn <= (select r from rest) then 1 else 0 end) / 100.0
           ) order by uid)
      into v_snapshot
      from parts;

    v_month := (v_first + make_interval(months => i - 1))::date;
    v_day := least(extract(day from v_local)::int,
                   extract(day from (v_month + interval '1 month' - interval '1 day'))::int);

    insert into public.expenses (
      group_id, paid_by, amount, currency, exchange_rate, rate_type, category_id, note,
      spent_at, installment_plan_id, installment_number, split_snapshot
    ) values (
      p_group_id, p_paid_by, v_amount / 100.0, p_currency, p_exchange_rate, p_rate_type, p_category_id, v_note,
      make_timestamptz(extract(year from v_month)::int, extract(month from v_month)::int, v_day,
                       extract(hour from v_local)::int, extract(minute from v_local)::int,
                       floor(extract(second from v_local)), v_tz),
      v_plan_id, i, v_snapshot
    ) returning id into v_expense_id;

    insert into public.expense_splits (expense_id, user_id, amount)
    select v_expense_id, (s->>'user_id')::uuid, (s->>'amount')::numeric
      from jsonb_array_elements(v_snapshot) s;
  end loop;

  return v_plan_id;
end $$;

revoke execute on function public.create_group_installment_plan(uuid, uuid, numeric, int, date, timestamptz, text, numeric, text, uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.create_group_installment_plan(uuid, uuid, numeric, int, date, timestamptz, text, numeric, text, uuid, text, text, text, jsonb) to authenticated;

-- Realtime for plans too (members see new purchases and voids instantly).
alter publication supabase_realtime add table public.installment_plans;
