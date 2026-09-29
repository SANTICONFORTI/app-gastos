-- Stage 10: savings goals, category budgets and recurring expenses (all personal).

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) default auth.uid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  target_amount numeric not null check (target_amount > 0),
  deadline date,
  color text not null default '#4ADE80',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);
create index savings_goals_owner_id_idx on public.savings_goals(owner_id);

-- Deposits (+) and withdrawals (-). Never deleted: voided with a reason.
create table public.savings_movements (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id),
  amount numeric not null check (amount <> 0),
  note text check (note is null or char_length(note) <= 60),
  status text not null default 'active' check (status in ('active', 'voided')),
  void_reason text,
  voided_at timestamptz,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint savings_movements_void_reason check (status = 'active' or char_length(trim(coalesce(void_reason, ''))) > 0)
);
create index savings_movements_goal_id_idx on public.savings_movements(goal_id);
create index savings_movements_created_by_idx on public.savings_movements(created_by);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) default auth.uid(),
  category_id uuid not null references public.categories(id),
  monthly_limit numeric not null check (monthly_limit > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index budgets_owner_id_idx on public.budgets(owner_id);
create index budgets_category_id_idx on public.budgets(category_id);
create unique index budgets_one_active_per_category on public.budgets(owner_id, category_id) where active;

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) default auth.uid(),
  note text not null check (char_length(trim(note)) between 1 and 60),
  amount numeric not null check (amount > 0),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  rate_type text check (rate_type is null or rate_type in ('blue', 'tarjeta')),
  category_id uuid references public.categories(id),
  day_of_month int not null check (day_of_month between 1 and 31),
  start_month date not null default date_trunc('month', now())::date,
  last_generated_month date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index recurring_expenses_owner_id_idx on public.recurring_expenses(owner_id);
create index recurring_expenses_category_id_idx on public.recurring_expenses(category_id);

alter table public.expenses add column recurring_id uuid references public.recurring_expenses(id);
create index expenses_recurring_id_idx on public.expenses(recurring_id);

-- RLS: each person only sees and changes their own; nothing is deleted.
alter table public.savings_goals enable row level security;
alter table public.savings_movements enable row level security;
alter table public.budgets enable row level security;
alter table public.recurring_expenses enable row level security;

create policy "Mis metas" on public.savings_goals for select to authenticated using (owner_id = (select auth.uid()));
create policy "Crear mis metas" on public.savings_goals for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Editar mis metas" on public.savings_goals for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "Movimientos de mis metas" on public.savings_movements for select to authenticated
  using (exists (select 1 from public.savings_goals g where g.id = goal_id and g.owner_id = (select auth.uid())));
create policy "Cargar movimientos en mis metas" on public.savings_movements for insert to authenticated
  with check (status = 'active' and exists (select 1 from public.savings_goals g where g.id = goal_id and g.owner_id = (select auth.uid())));
create policy "Anular movimientos de mis metas" on public.savings_movements for update to authenticated
  using (exists (select 1 from public.savings_goals g where g.id = goal_id and g.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.savings_goals g where g.id = goal_id and g.owner_id = (select auth.uid())));

create policy "Mis presupuestos" on public.budgets for select to authenticated using (owner_id = (select auth.uid()));
create policy "Crear mis presupuestos" on public.budgets for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Editar mis presupuestos" on public.budgets for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "Mis gastos fijos" on public.recurring_expenses for select to authenticated using (owner_id = (select auth.uid()));
create policy "Crear mis gastos fijos" on public.recurring_expenses for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Editar mis gastos fijos" on public.recurring_expenses for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Savings movements are only voided (with reason), never edited.
create function public.savings_movements_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'voided' then
    raise exception 'Un movimiento anulado no se puede modificar';
  end if;
  if new.status <> 'voided' or new.amount is distinct from old.amount or new.goal_id is distinct from old.goal_id
     or new.note is distinct from old.note or new.created_at is distinct from old.created_at then
    raise exception 'Un aporte no se edita: se anula con motivo';
  end if;
  new.voided_at := now();
  return new;
end $$;
create trigger savings_movements_guard before update on public.savings_movements
  for each row execute function public.savings_movements_guard();
revoke execute on function public.savings_movements_guard() from public, anon, authenticated;

-- Creates the expenses of my recurring expenses that are due up to today (Argentina time).
-- p_rates: {"blue": 1560, "tarjeta": 2008} for the ones in dollars (skipped if missing).
-- Returns how many expenses were created.
create function public.generate_recurring_expenses(p_rates jsonb default '{}'::jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_today date := (now() at time zone v_tz)::date;
  v_current date := date_trunc('month', v_today)::date;
  r public.recurring_expenses;
  v_month date;
  v_day int;
  v_rate numeric;
  v_count int := 0;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;
  for r in select * from public.recurring_expenses where owner_id = v_uid and active for update loop
    v_month := greatest(r.start_month, coalesce((r.last_generated_month + interval '1 month')::date, r.start_month));
    while v_month <= v_current loop
      v_day := least(r.day_of_month, extract(day from (v_month + interval '1 month' - interval '1 day'))::int);
      exit when v_month = v_current and v_day > extract(day from v_today)::int; -- not due yet this month
      v_rate := null;
      if r.currency = 'USD' then
        v_rate := nullif(p_rates ->> coalesce(r.rate_type, 'blue'), '')::numeric;
        exit when v_rate is null; -- no quote: try again next time
      end if;
      insert into public.expenses (owner_id, amount, currency, exchange_rate, rate_type, category_id, note, spent_at, recurring_id)
      values (v_uid, r.amount, r.currency, v_rate, case when r.currency = 'USD' then coalesce(r.rate_type, 'blue') end,
              r.category_id, r.note,
              make_timestamptz(extract(year from v_month)::int, extract(month from v_month)::int, v_day, 9, 0, 0, v_tz),
              r.id);
      update public.recurring_expenses set last_generated_month = v_month where id = r.id;
      v_count := v_count + 1;
      v_month := (v_month + interval '1 month')::date;
    end loop;
  end loop;
  return v_count;
end $$;

revoke execute on function public.generate_recurring_expenses(jsonb) from public, anon;
grant execute on function public.generate_recurring_expenses(jsonb) to authenticated;
