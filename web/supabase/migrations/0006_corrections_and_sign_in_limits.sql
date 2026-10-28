-- Udhaar Voice: correcting saved payments, and limiting repeated sign-in attempts.

-- A deleted payment is voided, not erased, like a deleted khata entry, so the history stays.
alter table payments add column voided_at timestamptz;

-- Same as in 0003_functions.sql, except that voided payments no longer count towards the balance.
create or replace function record_payment(p_customer_id uuid, p_amount integer, p_method payment_method, p_paid_on date)
  returns uuid
  language plpgsql
  set search_path = public
as $$
declare
  v_shop uuid := require_shop();
  v_id uuid;
  v_remaining integer := p_amount;
  v_balance integer;
  v_open uuid[];
  p record;
begin
  if not exists (select 1 from customers where id = p_customer_id and shop_id = v_shop) then
    raise exception 'Customer not found';
  end if;

  insert into payments (shop_id, customer_id, amount, method, paid_on)
  values (v_shop, p_customer_id, p_amount, p_method, p_paid_on)
  returning id into v_id;

  select coalesce(array_agg(o.id), '{}') into v_open from promises o
  where o.customer_id = p_customer_id and o.kept_at is null
    and not (
      o.due_date < p_paid_on
      and exists (select 1 from promises n where n.customer_id = o.customer_id and n.created_at > o.created_at)
    );

  for p in select id, amount from promises where id = any(v_open) order by due_date, created_at loop
    exit when v_remaining < p.amount;
    update promises set kept_at = now() where id = p.id;
    v_remaining := v_remaining - p.amount;
  end loop;

  -- Nothing owed any more: every open promise is kept.
  select coalesce((select sum(amount) from ledger_entries where customer_id = p_customer_id and voided_at is null), 0)
       - coalesce((select sum(amount) from payments where customer_id = p_customer_id and voided_at is null), 0)
    into v_balance;
  if v_balance <= 0 then
    update promises set kept_at = now() where id = any(v_open) and kept_at is null;
  end if;

  return v_id;
end;
$$;

-- Failed sign-ins and sign-ups, by phone or email and by network address, to slow down guessing.
-- Server only: no policies, so only the service role can read or write it.
create table sign_in_attempts (
  id bigint generated always as identity primary key,
  key text not null,
  at timestamptz not null default now()
);
create index sign_in_attempts_key on sign_in_attempts (key, at desc);
alter table sign_in_attempts enable row level security;
grant select, insert, delete on sign_in_attempts to service_role;
grant usage, select on all sequences in schema public to service_role;
