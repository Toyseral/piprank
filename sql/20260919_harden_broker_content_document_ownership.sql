-- Keep broker-owned rich content attached when a broker slug changes.
-- Broker content is keyed by broker:{slug}:{section}; the broker table itself
-- has no FK into content_documents, so this operation must be atomic.
create or replace function public.rename_broker_content_documents(
  p_old_slug text,
  p_new_slug text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text := lower(trim(p_old_slug));
  v_new text := lower(trim(p_new_slug));
begin
  if v_old is null or v_new is null or v_old = '' or v_new = '' then
    raise exception 'Broker slugs are required';
  end if;

  if v_old = v_new then
    return;
  end if;

  if exists (
    select 1
    from public.content_documents
    where content_type = 'broker'
      and (
        slug = v_new
        or content_key like 'broker:' || v_new || ':%'
      )
  ) then
    raise exception 'Broker content already exists for target slug: %', v_new;
  end if;

  update public.content_documents
  set
    content_key = 'broker:' || v_new || substring(content_key from length('broker:' || v_old) + 1),
    slug = case when slug = v_old then v_new else slug end,
    updated_at = now()
  where content_type = 'broker'
    and content_key like 'broker:' || v_old || ':%';
end;
$$;

revoke all on function public.rename_broker_content_documents(text, text) from public;
revoke all on function public.rename_broker_content_documents(text, text) from anon;
revoke all on function public.rename_broker_content_documents(text, text) from authenticated;
grant execute on function public.rename_broker_content_documents(text, text) to service_role;
