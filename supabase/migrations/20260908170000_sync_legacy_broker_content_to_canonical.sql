create or replace function public.sync_legacy_broker_content_to_canonical()
returns trigger
language plpgsql
as $$
declare
  key text := 'broker:' || new.slug || ':main';
  existing_blocks jsonb;
  blocks jsonb := '[]'::jsonb;
  v text;
  i int := 0;
  escaped text;
begin
  select coalesce(cd.blocks, '[]'::jsonb) into existing_blocks
  from public.content_documents cd
  where cd.content_key = key
  limit 1;

  if jsonb_array_length(coalesce(existing_blocks,'[]'::jsonb)) > 0 then
    return new;
  end if;

  if coalesce(new.review,'') <> '' then
    for v in select jsonb_array_elements_text(coalesce(new.review,'[]'::jsonb)) loop
      i := i + 1;
      escaped := replace(replace(replace(v,'&','&amp;'),'<','&lt;'),'>','&gt;');
      blocks := blocks || jsonb_build_array(jsonb_build_object('id',md5(key||':review:'||i||':'||v),'type','richtext','html','<p>'||escaped||'</p>','zone','overview'));
    end loop;
  end if;

  if jsonb_typeof(coalesce(new.pros,'[]'::jsonb)) = 'array' and jsonb_array_length(new.pros) > 0 then
    blocks := blocks || jsonb_build_array(jsonb_build_object('id',md5(key||':pros-heading'),'type','heading','title','Pros','zone','editorial_after_trust'));
    i := 0;
    for v in select jsonb_array_elements_text(new.pros) loop
      i := i + 1;
      escaped := replace(replace(replace(v,'&','&amp;'),'<','&lt;'),'>','&gt;');
      blocks := blocks || jsonb_build_array(jsonb_build_object('id',md5(key||':pros:'||i||':'||v),'type','richtext','html','<p>✓ '||escaped||'</p>','zone','editorial_after_trust'));
    end loop;
  end if;

  if jsonb_typeof(coalesce(new.cons,'[]'::jsonb)) = 'array' and jsonb_array_length(new.cons) > 0 then
    blocks := blocks || jsonb_build_array(jsonb_build_object('id',md5(key||':cons-heading'),'type','heading','title','Cons','zone','editorial_after_trust'));
    i := 0;
    for v in select jsonb_array_elements_text(new.cons) loop
      i := i + 1;
      escaped := replace(replace(replace(v,'&','&amp;'),'<','&lt;'),'>','&gt;');
      blocks := blocks || jsonb_build_array(jsonb_build_object('id',md5(key||':cons:'||i||':'||v),'type','richtext','html','<p>• '||escaped||'</p>','zone','editorial_after_trust'));
    end loop;
  end if;

  insert into public.content_documents (content_key,content_type,country_slug,topic_slug,slug,title,excerpt,html,blocks,seo_title,seo_description,indexable,published,settings,created_at,updated_at)
  values (key,'broker',null,null,'main',new.name||' Review 2026','','',blocks,new.name||' Review 2026 | PipRank','Read the PipRank '||new.name||' review, including costs, platforms, regulation and who it may suit.',true,true,jsonb_build_object('zones',jsonb_build_object('overview','overview','editorial_after_trust','editorial_after_trust')),now(),now())
  on conflict (content_key) do update set
    blocks=case when jsonb_array_length(coalesce(public.content_documents.blocks,'[]'::jsonb)) > 0 then public.content_documents.blocks else excluded.blocks end,
    title=coalesce(public.content_documents.title,excluded.title),
    published=true,
    indexable=true,
    updated_at=now();
  return new;
end;
$$;

drop trigger if exists sync_legacy_broker_content_to_canonical on public.brokers;
create trigger sync_legacy_broker_content_to_canonical
after insert or update of name, slug, tagline, review, pros, cons, faqs on public.brokers
for each row execute function public.sync_legacy_broker_content_to_canonical();

update public.brokers set name=name;
