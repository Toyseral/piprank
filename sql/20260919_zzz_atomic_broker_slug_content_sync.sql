-- Make broker slug/content ownership atomic: the trigger runs in the same
-- transaction as the brokers update, so a failed content rename rolls back
-- the broker slug change too.
create or replace function public.rename_broker_content_documents_on_slug_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.slug is distinct from new.slug then
    perform public.rename_broker_content_documents(old.slug, new.slug);
  end if;
  return new;
end;
$$;

revoke all on function public.rename_broker_content_documents_on_slug_change() from public;
revoke all on function public.rename_broker_content_documents_on_slug_change() from anon;
revoke all on function public.rename_broker_content_documents_on_slug_change() from authenticated;
grant execute on function public.rename_broker_content_documents_on_slug_change() to service_role;

drop trigger if exists trg_rename_broker_content_documents_on_slug_change on public.brokers;
create trigger trg_rename_broker_content_documents_on_slug_change
before update of slug on public.brokers
for each row
execute function public.rename_broker_content_documents_on_slug_change();
