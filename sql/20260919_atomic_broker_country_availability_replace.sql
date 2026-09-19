create or replace function public.replace_broker_country_availability(
  p_broker_id bigint,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row jsonb;
  v_country_id bigint;
  v_status text;
  v_note text;
  v_priority integer;
begin
  if p_broker_id is null or p_broker_id <= 0 then
    raise exception 'broker_id is required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.brokers where id = p_broker_id) then
    raise exception 'Broker not found' using errcode = '23503';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be a JSON array' using errcode = '22023';
  end if;

  for row in select value from jsonb_array_elements(p_rows)
  loop
    v_country_id := nullif(trim(row->>'country_id'), '')::bigint;
    v_status := lower(trim(coalesce(row->>'status', 'available')));
    v_note := nullif(left(coalesce(row->>'note', ''), 500), '');
    v_priority := coalesce(nullif(trim(row->>'priority'), '')::integer, 0);

    if v_country_id is null or v_country_id <= 0 then
      raise exception 'Invalid country_id' using errcode = '22023';
    end if;

    if v_status not in ('available', 'restricted', 'unavailable') then
      raise exception 'Invalid availability status: %', v_status using errcode = '22023';
    end if;

    if v_priority < 0 then
      raise exception 'priority cannot be negative' using errcode = '22023';
    end if;

    if not exists (select 1 from public.countries where id = v_country_id) then
      raise exception 'Country not found: %', v_country_id using errcode = '23503';
    end if;
  end loop;

  delete from public.broker_country_availability
  where broker_id = p_broker_id;

  insert into public.broker_country_availability (
    broker_id, country_id, is_available, status, notes, note, priority, updated_at
  )
  select
    p_broker_id,
    x.country_id,
    x.status <> 'unavailable',
    x.status,
    x.note,
    x.note,
    x.priority,
    now()
  from (
    select distinct on (country_id)
      nullif(trim(value->>'country_id'), '')::bigint as country_id,
      lower(trim(coalesce(value->>'status', 'available'))) as status,
      nullif(left(coalesce(value->>'note', ''), 500), '') as note,
      coalesce(nullif(trim(value->>'priority'), '')::integer, 0) as priority
    from jsonb_array_elements(p_rows)
    order by country_id, (value->>'priority')::integer desc nulls last
  ) x
  where x.status <> 'available'
     or x.note is not null
     or x.priority <> 0;
end;
$$;

revoke all on function public.replace_broker_country_availability(bigint, jsonb) from public;
grant execute on function public.replace_broker_country_availability(bigint, jsonb) to service_role;