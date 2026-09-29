-- Events: inside a group ("Juntada casa Roberto") or standalone (group_id null).
-- Participants are group members, registered users or guests with just a name.
-- Guests see the event through a public link (long random token) using security definer
-- RPCs only; anonymous users never get direct access to the tables.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id),
  name text not null check (char_length(trim(name)) between 1 and 60),
  event_date date not null default current_date,
  status text not null default 'open' check (status in ('open', 'closed')),
  share_token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  share_active boolean not null default true,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz
);
create index events_group_id_idx on public.events(group_id);
create index events_created_by_idx on public.events(created_by);
create index events_closed_by_idx on public.events(closed_by);

create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  user_id uuid references public.profiles(id),
  guest_name text check (guest_name is null or char_length(trim(guest_name)) between 1 and 40),
  claimed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint event_participants_who check (user_id is not null or guest_name is not null),
  constraint event_participants_unique_user unique (event_id, user_id)
);
create index event_participants_event_id_idx on public.event_participants(event_id);
create index event_participants_user_id_idx on public.event_participants(user_id);
create index event_participants_claimed_by_idx on public.event_participants(claimed_by);

create table public.event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  paid_by uuid not null references public.event_participants(id),
  amount numeric not null check (amount > 0),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  exchange_rate numeric check (exchange_rate is null or exchange_rate > 0),
  note text check (note is null or char_length(note) <= 80),
  spent_at timestamptz not null default now(),
  split_snapshot jsonb not null,
  status text not null default 'active' check (status in ('active', 'voided')),
  voided_by uuid references public.profiles(id),
  voided_at timestamptz,
  void_reason text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint event_expenses_void_reason check (status = 'active' or char_length(trim(coalesce(void_reason, ''))) > 0)
);
create index event_expenses_event_id_idx on public.event_expenses(event_id);
create index event_expenses_paid_by_idx on public.event_expenses(paid_by);
create index event_expenses_created_by_idx on public.event_expenses(created_by);
create index event_expenses_voided_by_idx on public.event_expenses(voided_by);

-- Payments: 'reported' (someone said "Ya pagué") -> 'confirmed' by an event admin, or 'voided'.
create table public.event_payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  from_participant uuid not null references public.event_participants(id),
  to_participant uuid not null references public.event_participants(id),
  amount numeric not null check (amount > 0),
  status text not null default 'reported' check (status in ('reported', 'confirmed', 'voided')),
  reported_via text not null default 'app' check (reported_via in ('app', 'link')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  voided_by uuid references public.profiles(id),
  voided_at timestamptz,
  void_reason text,
  constraint event_payments_distinct check (from_participant <> to_participant),
  constraint event_payments_void_reason check (status <> 'voided' or char_length(trim(coalesce(void_reason, ''))) > 0)
);
create index event_payments_event_id_idx on public.event_payments(event_id);
create index event_payments_from_idx on public.event_payments(from_participant);
create index event_payments_to_idx on public.event_payments(to_participant);
create index event_payments_created_by_idx on public.event_payments(created_by);
create index event_payments_confirmed_by_idx on public.event_payments(confirmed_by);
create index event_payments_voided_by_idx on public.event_payments(voided_by);

-- Helpers (private schema, not exposed by the API) ---------------------------

create function private.can_see_event(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = eid and (
      e.created_by = (select auth.uid())
      or (e.group_id is not null and private.is_group_member(e.group_id))
      or exists (select 1 from public.event_participants p where p.event_id = e.id and p.user_id = (select auth.uid()))
    )
  );
$$;

create function private.is_event_admin(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = eid and (
      e.created_by = (select auth.uid())
      or (e.group_id is not null and private.is_group_admin(e.group_id))
    )
  );
$$;

create function private.is_event_open(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = eid and e.status = 'open');
$$;

revoke execute on function private.can_see_event(uuid) from public, anon;
revoke execute on function private.is_event_admin(uuid) from public, anon;
revoke execute on function private.is_event_open(uuid) from public, anon;
grant execute on function private.can_see_event(uuid) to authenticated;
grant execute on function private.is_event_admin(uuid) to authenticated;
grant execute on function private.is_event_open(uuid) to authenticated;

-- RLS -------------------------------------------------------------------------

alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.event_expenses enable row level security;
alter table public.event_payments enable row level security;

create policy "Ver eventos donde participo, de mis grupos o que creé" on public.events
  for select to authenticated using (private.can_see_event(id));
create policy "Crear eventos sueltos o como admin del grupo" on public.events
  for insert to authenticated
  with check (created_by = (select auth.uid()) and (group_id is null or private.is_group_admin(group_id)));
create policy "Admins del evento lo editan" on public.events
  for update to authenticated using (private.is_event_admin(id)) with check (private.is_event_admin(id));

create policy "Ver participantes de eventos visibles" on public.event_participants
  for select to authenticated using (private.can_see_event(event_id));
create policy "Admins del evento suman participantes" on public.event_participants
  for insert to authenticated
  with check (
    private.is_event_admin(event_id) and private.is_event_open(event_id) and claimed_by is null
    and (
      user_id is null
      or user_id = (select auth.uid())
      or exists (select 1 from public.events e where e.id = event_id and e.group_id is not null
                 and private.is_user_in_group(e.group_id, user_id))
    )
  );
create policy "Admins del evento renombran invitados" on public.event_participants
  for update to authenticated using (private.is_event_admin(event_id)) with check (private.is_event_admin(event_id));

create policy "Ver gastos de eventos visibles" on public.event_expenses
  for select to authenticated using (private.can_see_event(event_id));
create policy "Admins del evento cargan gastos" on public.event_expenses
  for insert to authenticated with check (private.is_event_admin(event_id) and private.is_event_open(event_id));
create policy "Admins del evento anulan gastos" on public.event_expenses
  for update to authenticated using (private.is_event_admin(event_id)) with check (private.is_event_admin(event_id));

create policy "Ver pagos de eventos visibles" on public.event_payments
  for select to authenticated using (private.can_see_event(event_id));
create policy "Informar mi pago o registrar pagos como admin" on public.event_payments
  for insert to authenticated
  with check (
    private.can_see_event(event_id)
    and (
      private.is_event_admin(event_id)
      or (status = 'reported' and exists (
            select 1 from public.event_participants p
            where p.id = from_participant and p.event_id = event_payments.event_id and p.user_id = (select auth.uid())))
    )
  );
create policy "Admins del evento confirman o anulan pagos" on public.event_payments
  for update to authenticated using (private.is_event_admin(event_id)) with check (private.is_event_admin(event_id));

-- Triggers ----------------------------------------------------------------------

-- The creator is always a participant.
create function public.events_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.event_participants (event_id, user_id) values (new.id, new.created_by);
  end if;
  return null;
end $$;

create function public.events_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.group_id is distinct from old.group_id or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'No se puede cambiar el grupo ni el autor de un evento';
  end if;
  if old.status = 'closed' and new.status = 'open' then
    raise exception 'Un evento cerrado no se puede reabrir';
  end if;
  if old.status = 'closed' and (new.name is distinct from old.name or new.event_date is distinct from old.event_date) then
    raise exception 'Un evento cerrado no se puede editar';
  end if;
  if new.status = 'closed' and old.status = 'open' then
    new.closed_by := auth.uid();
    new.closed_at := now();
  end if;
  return new;
end $$;

create function public.event_participants_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.event_id is distinct from old.event_id then
      raise exception 'No se puede mover un participante de evento';
    end if;
    -- Direct updates can only rename guests; claiming goes through claim_event_guest().
    if current_user = 'authenticated'
       and (new.user_id is distinct from old.user_id or new.claimed_by is distinct from old.claimed_by) then
      raise exception 'Para vincular un invitado a una cuenta, la persona tiene que reclamar su lugar';
    end if;
  end if;
  return new;
end $$;

create function public.event_expenses_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_sum numeric;
  v_count int;
  v_distinct int;
begin
  if tg_op = 'INSERT' then
    new.status := 'active';
    new.voided_by := null;
    new.voided_at := null;
    new.void_reason := null;
    new.created_by := auth.uid();
    new.created_at := now();
    if not exists (select 1 from public.event_participants p where p.id = new.paid_by and p.event_id = new.event_id) then
      raise exception 'Quien pagó tiene que participar del evento';
    end if;
    if jsonb_typeof(new.split_snapshot) <> 'array' or jsonb_array_length(new.split_snapshot) = 0 then
      raise exception 'Elegí entre quiénes se divide el gasto';
    end if;
    select coalesce(sum(round((s->>'participant_id' is not null)::int * (s->>'amount')::numeric, 2)), 0),
           count(*), count(distinct s->>'participant_id')
      into v_sum, v_count, v_distinct
      from jsonb_array_elements(new.split_snapshot) s;
    if v_count <> v_distinct then
      raise exception 'Hay una persona repetida en la división';
    end if;
    if abs(v_sum - round(new.amount, 2)) > 0.001 then
      raise exception 'La división no suma el total del gasto';
    end if;
    if exists (
      select 1 from jsonb_array_elements(new.split_snapshot) s
      where (s->>'amount')::numeric < 0
         or not exists (select 1 from public.event_participants p
                        where p.id = (s->>'participant_id')::uuid and p.event_id = new.event_id)
    ) then
      raise exception 'La división incluye a alguien que no participa del evento';
    end if;
    return new;
  end if;

  -- UPDATE: expenses are never edited, only voided (with a reason).
  if old.status = 'voided' then
    raise exception 'Un gasto anulado no se puede modificar';
  end if;
  if new.status <> 'voided'
     or new.event_id is distinct from old.event_id or new.paid_by is distinct from old.paid_by
     or new.amount is distinct from old.amount or new.currency is distinct from old.currency
     or new.exchange_rate is distinct from old.exchange_rate or new.note is distinct from old.note
     or new.spent_at is distinct from old.spent_at or new.split_snapshot is distinct from old.split_snapshot
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Un gasto de evento no se edita: se anula con motivo y se carga de nuevo';
  end if;
  new.voided_by := auth.uid();
  new.voided_at := now();
  return new;
end $$;

create function public.event_payments_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.event_participants p where p.id = new.from_participant and p.event_id = new.event_id)
       or not exists (select 1 from public.event_participants p where p.id = new.to_participant and p.event_id = new.event_id) then
      raise exception 'Las dos personas tienen que participar del evento';
    end if;
    new.created_at := now();
    new.voided_by := null;
    new.voided_at := null;
    new.void_reason := null;
    if new.reported_via = 'app' then
      new.created_by := auth.uid();
    end if;
    if new.status = 'confirmed' then
      new.confirmed_by := auth.uid();
      new.confirmed_at := now();
    else
      new.status := 'reported';
      new.confirmed_by := null;
      new.confirmed_at := null;
    end if;
    return new;
  end if;

  if new.event_id is distinct from old.event_id or new.from_participant is distinct from old.from_participant
     or new.to_participant is distinct from old.to_participant or new.amount is distinct from old.amount
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
     or new.reported_via is distinct from old.reported_via then
    raise exception 'Un pago no se edita: se confirma o se anula';
  end if;
  if old.status = 'voided' then
    raise exception 'Un pago anulado no se puede modificar';
  end if;
  if new.status = 'confirmed' and old.status = 'reported' then
    new.confirmed_by := auth.uid();
    new.confirmed_at := now();
  elsif new.status = 'voided' then
    new.voided_by := auth.uid();
    new.voided_at := now();
  elsif new.status is distinct from old.status then
    raise exception 'Ese cambio de estado no está permitido';
  end if;
  return new;
end $$;

create trigger events_after_insert after insert on public.events
  for each row execute function public.events_after_insert();
create trigger events_before_update before update on public.events
  for each row execute function public.events_before_update();
create trigger event_participants_guard before insert or update on public.event_participants
  for each row execute function public.event_participants_guard();
create trigger event_expenses_guard before insert or update on public.event_expenses
  for each row execute function public.event_expenses_guard();
create trigger event_payments_guard before insert or update on public.event_payments
  for each row execute function public.event_payments_guard();

revoke execute on function public.events_after_insert() from public, anon, authenticated;
revoke execute on function public.events_before_update() from public, anon, authenticated;
revoke execute on function public.event_participants_guard() from public, anon, authenticated;
revoke execute on function public.event_expenses_guard() from public, anon, authenticated;
revoke execute on function public.event_payments_guard() from public, anon, authenticated;

-- Public link RPCs --------------------------------------------------------------

-- What a guest sees through the link: no user ids, only participant ids and names.
create function public.get_public_event(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_event public.events;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'Link inválido';
  end if;
  select * into v_event from public.events where share_token = p_token and share_active;
  if not found then
    raise exception 'Este link no existe o fue desactivado';
  end if;
  return jsonb_build_object(
    'name', v_event.name,
    'date', v_event.event_date,
    'status', v_event.status,
    'group_name', (select g.name from public.groups g where g.id = v_event.group_id),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', coalesce(pr.display_name, p.guest_name),
        'is_guest', p.user_id is null,
        'avatar_url', pr.avatar_url,
        'alias', pr.alias_cvu
      ) order by p.created_at)
      from public.event_participants p left join public.profiles pr on pr.id = p.user_id
      where p.event_id = v_event.id), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'note', x.note, 'amount', x.amount, 'currency', x.currency,
        'exchange_rate', x.exchange_rate, 'paid_by', x.paid_by, 'split', x.split_snapshot,
        'status', x.status, 'void_reason', x.void_reason, 'spent_at', x.spent_at
      ) order by x.spent_at)
      from public.event_expenses x where x.event_id = v_event.id), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', y.id, 'from', y.from_participant, 'to', y.to_participant,
        'amount', y.amount, 'status', y.status, 'created_at', y.created_at
      ) order by y.created_at)
      from public.event_payments y where y.event_id = v_event.id), '[]'::jsonb)
  );
end $$;

-- A guest says "Ya pagué" from the link: stays 'reported' until an event admin confirms it.
create function public.report_guest_payment(p_token text, p_from uuid, p_to uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events;
  v_recent int;
begin
  select * into v_event from public.events where share_token = p_token and share_active;
  if not found then
    raise exception 'Este link no existe o fue desactivado';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
    raise exception 'Monto inválido';
  end if;
  if not exists (select 1 from public.event_participants p
                 where p.id = p_from and p.event_id = v_event.id and p.user_id is null) then
    raise exception 'Solo los invitados sin cuenta informan pagos desde el link';
  end if;
  if not exists (select 1 from public.event_participants p where p.id = p_to and p.event_id = v_event.id) then
    raise exception 'Esa persona no participa del evento';
  end if;
  -- Simple abuse limit per event.
  select count(*) into v_recent from public.event_payments
   where event_id = v_event.id and reported_via = 'link' and created_at > now() - interval '1 hour';
  if v_recent >= 30 then
    raise exception 'Demasiados avisos de pago seguidos. Probá más tarde.';
  end if;
  insert into public.event_payments (event_id, from_participant, to_participant, amount, status, reported_via)
  values (v_event.id, p_from, p_to, round(p_amount, 2), 'reported', 'link');
end $$;

-- A registered user claims a guest spot ("ese era yo") and keeps its history.
create function public.claim_event_guest(p_token text, p_participant uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión';
  end if;
  select * into v_event from public.events where share_token = p_token and share_active;
  if not found then
    raise exception 'Este link no existe o fue desactivado';
  end if;
  if exists (select 1 from public.event_participants p where p.event_id = v_event.id and p.user_id = auth.uid()) then
    raise exception 'Ya participás de este evento con tu cuenta';
  end if;
  update public.event_participants
     set user_id = auth.uid(), claimed_by = auth.uid()
   where id = p_participant and event_id = v_event.id and user_id is null;
  if not found then
    raise exception 'Ese lugar ya fue reclamado';
  end if;
  return v_event.id;
end $$;

revoke execute on function public.get_public_event(text) from public;
revoke execute on function public.report_guest_payment(text, uuid, uuid, numeric) from public;
revoke execute on function public.claim_event_guest(text, uuid) from public, anon;
grant execute on function public.get_public_event(text) to anon, authenticated;
grant execute on function public.report_guest_payment(text, uuid, uuid, numeric) to anon, authenticated;
grant execute on function public.claim_event_guest(text, uuid) to authenticated;

alter publication supabase_realtime add table public.events, public.event_participants, public.event_expenses, public.event_payments;
