create or replace function public.cleanup_broker_content_documents_on_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.content_documents
  where content_type = 'broker'
    and (
      slug = old.slug
      or content_key like 'broker:' || old.slug || ':%'
    );
  return old;
end;
$$;

revoke all on function public.cleanup_broker_content_documents_on_delete() from public;
revoke all on function public.cleanup_broker_content_documents_on_delete() from anon;
revoke all on function public.cleanup_broker_content_documents_on_delete() from authenticated;
grant execute on function public.cleanup_broker_content_documents_on_delete() to service_role;

drop trigger if exists trg_cleanup_broker_content_documents_on_delete on public.brokers;

create trigger trg_cleanup_broker_content_documents_on_delete
after delete on public.brokers
for each row
execute function public.cleanup_broker_content_documents_on_delete();
