-- Installment purchases: one plan + one expense per installment (each dated in its own month).
-- Personal only for now; group plans arrive with stage 6.

create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id),
  group_id uuid references public.groups(id),
  total_amount numeric not null check (total_amount > 0),
  installment_count int not null check (installment_count between 2 and 60),
  first_month date not null,
  card text check (card is null or char_length(card) <= 40),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  exchange_rate numeric check (exchange_rate is null or exchange_rate > 0),
  rate_type text,
  category_id uuid references public.categories(id),
  note text check (note is null or char_length(note) <= 120),
  receipt_path text,
  purchased_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'voided')),
  voided_by uuid references public.profiles(id),
  voided_at timestamptz,
  void_reason text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint installment_plans_one_space check ((owner_id is null) <> (group_id is null))
);

create index installment_plans_owner_id_idx on public.installment_plans(owner_id);
create index installment_plans_group_id_idx on public.installment_plans(group_id);
create index installment_plans_category_id_idx on public.installment_plans(category_id);
create index installment_plans_created_by_idx on public.installment_plans(created_by);
create index installment_plans_voided_by_idx on public.installment_plans(voided_by);

alter table public.installment_plans enable row level security;

create policy "Ver mis compras en cuotas y las de mis grupos" on public.installment_plans
  for select to authenticated
  using (owner_id = (select auth.uid()) or (group_id is not null and private.is_group_member(group_id)));

create policy "Cargar compras en cuotas personales" on public.installment_plans
  for insert to authenticated
  with check (group_id is null and owner_id = (select auth.uid()));

create policy "Editar o anular compras en cuotas personales" on public.installment_plans
  for update to authenticated
  using (group_id is null and owner_id = (select auth.uid()))
  with check (group_id is null and owner_id = (select auth.uid()));

-- Installments live in expenses.
alter table public.expenses
  add column installment_plan_id uuid references public.installment_plans(id),
  add column installment_number int check (installment_number is null or installment_number >= 1),
  add constraint expenses_installment_pair check ((installment_plan_id is null) = (installment_number is null)),
  add constraint expenses_installment_unique unique (installment_plan_id, installment_number);

-- Plan history (who changed what and when), written only by triggers.
create table public.installment_plan_history (
  id bigint generated always as identity primary key,
  plan_id uuid not null references public.installment_plans(id),
  action text not null check (action in ('created', 'edited', 'voided')),
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now(),
  before jsonb,
  after jsonb
);

create index installment_plan_history_plan_id_idx on public.installment_plan_history(plan_id);
create index installment_plan_history_changed_by_idx on public.installment_plan_history(changed_by);

alter table public.installment_plan_history enable row level security;

create policy "Ver historial de compras visibles" on public.installment_plan_history
  for select to authenticated
  using (exists (select 1 from public.installment_plans p where p.id = installment_plan_history.plan_id));

-- Triggers on plans ---------------------------------------------------------

create function public.installment_plans_before_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.status := 'active';
  new.voided_by := null;
  new.voided_at := null;
  new.void_reason := null;
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  new.first_month := date_trunc('month', new.first_month)::date;
  new.created_at := now();
  new.updated_at := now();
  return new;
end $$;

create function public.installment_plans_before_update()
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
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Para cambiar montos o cuotas, anulá la compra y cargala de nuevo';
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

create function public.installment_plans_log_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.installment_plan_history (plan_id, action, changed_by, after)
    values (new.id, 'created', auth.uid(), to_jsonb(new));
  else
    insert into public.installment_plan_history (plan_id, action, changed_by, before, after)
    values (
      new.id,
      case when new.status = 'voided' and old.status = 'active' then 'voided' else 'edited' end,
      auth.uid(), to_jsonb(old), to_jsonb(new)
    );
  end if;
  return null;
end $$;

create trigger installment_plans_before_insert before insert on public.installment_plans
  for each row execute function public.installment_plans_before_insert();
create trigger installment_plans_before_update before update on public.installment_plans
  for each row execute function public.installment_plans_before_update();
create trigger installment_plans_log_history after insert or update on public.installment_plans
  for each row execute function public.installment_plans_log_history();

-- Protect installments and require a void reason on every expense -----------

create function public.expenses_protect_installments()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_plan public.installment_plans;
begin
  if tg_op = 'INSERT' then
    if new.installment_plan_id is not null then
      select * into v_plan from public.installment_plans p where p.id = new.installment_plan_id;
      if not found
         or v_plan.status <> 'active'
         or v_plan.owner_id is distinct from new.owner_id
         or v_plan.group_id is distinct from new.group_id then
        raise exception 'La cuota no corresponde a una compra válida';
      end if;
    end if;
    return new;
  end if;

  if new.installment_plan_id is distinct from old.installment_plan_id
     or new.installment_number is distinct from old.installment_number then
    raise exception 'No se puede cambiar a qué compra pertenece una cuota';
  end if;
  if old.installment_plan_id is not null
     and (new.amount is distinct from old.amount
          or new.currency is distinct from old.currency
          or new.exchange_rate is distinct from old.exchange_rate
          or new.rate_type is distinct from old.rate_type
          or new.spent_at is distinct from old.spent_at) then
    raise exception 'El monto y la fecha de una cuota se cambian anulando la compra';
  end if;
  if new.status = 'voided' and old.status = 'active' and coalesce(trim(new.void_reason), '') = '' then
    raise exception 'El motivo de la anulación es obligatorio';
  end if;
  return new;
end $$;

create trigger expenses_protect_installments before insert or update on public.expenses
  for each row execute function public.expenses_protect_installments();

-- RPCs (security invoker: RLS still applies) ---------------------------------

create function public.create_installment_plan(
  p_total_amount numeric,
  p_installment_count int,
  p_first_month date,
  p_purchased_at timestamptz,
  p_currency text default 'ARS',
  p_exchange_rate numeric default null,
  p_rate_type text default null,
  p_category_id uuid default null,
  p_note text default null,
  p_card text default null,
  p_receipt_path text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_local timestamp := p_purchased_at at time zone v_tz;
  v_first date := date_trunc('month', p_first_month)::date;
  v_total_cents bigint;
  v_base bigint;
  v_month date;
  v_day int;
  v_note text := nullif(trim(p_note), '');
  v_plan_id uuid;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;
  if p_installment_count is null or p_installment_count < 2 or p_installment_count > 60 then
    raise exception 'Elegí entre 2 y 60 cuotas';
  end if;
  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'El monto tiene que ser mayor a cero';
  end if;

  v_total_cents := round(p_total_amount * 100);
  v_base := v_total_cents / p_installment_count;

  insert into public.installment_plans (
    owner_id, total_amount, installment_count, first_month, card, currency,
    exchange_rate, rate_type, category_id, note, receipt_path, purchased_at
  ) values (
    v_uid, v_total_cents / 100.0, p_installment_count, v_first, nullif(trim(p_card), ''), p_currency,
    p_exchange_rate, p_rate_type, p_category_id, v_note, p_receipt_path, p_purchased_at
  ) returning id into v_plan_id;

  for i in 1..p_installment_count loop
    v_month := (v_first + make_interval(months => i - 1))::date;
    -- Same day as the purchase, clamped to the month's length (31 -> 30, 28...).
    v_day := least(extract(day from v_local)::int,
                   extract(day from (v_month + interval '1 month' - interval '1 day'))::int);
    insert into public.expenses (
      owner_id, amount, currency, exchange_rate, rate_type, category_id, note,
      spent_at, installment_plan_id, installment_number
    ) values (
      v_uid,
      case when i = p_installment_count
        then (v_total_cents - v_base * (p_installment_count - 1)) / 100.0
        else v_base / 100.0 end,
      p_currency, p_exchange_rate, p_rate_type, p_category_id, v_note,
      make_timestamptz(extract(year from v_month)::int, extract(month from v_month)::int, v_day,
                       extract(hour from v_local)::int, extract(minute from v_local)::int,
                       floor(extract(second from v_local)), v_tz),
      v_plan_id, i
    );
  end loop;

  return v_plan_id;
end $$;

create function public.edit_installment_plan(
  p_plan_id uuid, p_category_id uuid, p_note text, p_card text
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_plan public.installment_plans;
  v_note text := nullif(trim(p_note), '');
  v_card text := nullif(trim(p_card), '');
begin
  select * into v_plan from public.installment_plans where id = p_plan_id;
  if not found then
    raise exception 'Compra no encontrada';
  end if;
  if v_plan.status <> 'active' then
    raise exception 'Una compra anulada no se puede modificar';
  end if;
  if v_plan.category_id is not distinct from p_category_id
     and v_plan.note is not distinct from v_note
     and v_plan.card is not distinct from v_card then
    return false;
  end if;

  update public.installment_plans
     set category_id = p_category_id, note = v_note, card = v_card
   where id = p_plan_id;

  update public.expenses
     set category_id = p_category_id, note = v_note
   where installment_plan_id = p_plan_id
     and status = 'active'
     and (category_id is distinct from p_category_id or note is distinct from v_note);

  return true;
end $$;

-- Voids a purchase: installments after the current month (Argentina time) are voided;
-- this month's and earlier ones were already charged and stay.
create function public.void_installment_plan(p_plan_id uuid, p_reason text)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_reason text := trim(p_reason);
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_count int;
begin
  if coalesce(v_reason, '') = '' then
    raise exception 'El motivo es obligatorio';
  end if;

  update public.installment_plans
     set status = 'voided', void_reason = v_reason
   where id = p_plan_id and status = 'active';
  if not found then
    raise exception 'La compra no existe o ya está anulada';
  end if;

  update public.expenses
     set status = 'voided', void_reason = 'Compra anulada: ' || v_reason
   where installment_plan_id = p_plan_id
     and status = 'active'
     and date_trunc('month', spent_at at time zone v_tz) > date_trunc('month', now() at time zone v_tz);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.create_installment_plan(numeric, int, date, timestamptz, text, numeric, text, uuid, text, text, text) from public, anon;
revoke execute on function public.edit_installment_plan(uuid, uuid, text, text) from public, anon;
revoke execute on function public.void_installment_plan(uuid, text) from public, anon;
grant execute on function public.create_installment_plan(numeric, int, date, timestamptz, text, numeric, text, uuid, text, text, text) to authenticated;
grant execute on function public.edit_installment_plan(uuid, uuid, text, text) to authenticated;
grant execute on function public.void_installment_plan(uuid, text) to authenticated;
