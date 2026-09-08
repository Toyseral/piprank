create or replace function public.sync_legacy_country_best_for_to_canonical_topic_content()
returns trigger
language plpgsql
as $$
declare
  country_slug text;
  canonical_slug text;
  key text;
  source_blocks jsonb := '[]'::jsonb;
  converted jsonb := '[]'::jsonb;
  section jsonb;
  body text;
  idx int := 0;
begin
  select slug into country_slug from public.countries where id = new.country_id limit 1;
  if country_slug is null then return new; end if;

  canonical_slug := case new.slug
    when 'beginners' then 'forex-brokers-for-beginners'
    when 'low-spread' then 'low-spread-forex-brokers'
    when 'mt5' then 'mt5-forex-brokers'
    when 'gold' then 'gold-forex-brokers'
    when 'scalping' then 'forex-brokers-for-scalping'
    when 'islamic' then 'islamic-forex-brokers'
    when 'ecn' then 'ecn-forex-brokers'
    when 'copy-trading' then 'copy-trading-forex-brokers'
    when 'swing-trading' then 'forex-brokers-for-swing-trading'
    when 'high-leverage' then 'high-leverage-forex-brokers'
    else new.slug
  end;
  key := 'country-topic:' || country_slug || ':' || canonical_slug;

  source_blocks := coalesce(new.blocks,'[]'::jsonb);
  if jsonb_array_length(source_blocks) = 0 then
    if jsonb_typeof(coalesce(new.sections,'[]'::jsonb)) = 'array' then
      for section in select jsonb_array_elements(coalesce(new.sections,'[]'::jsonb)) loop
        idx := idx + 1;
        if coalesce(section->>'heading','') <> '' then
          converted := converted || jsonb_build_array(jsonb_build_object('id',md5(key||':heading:'||idx),'type','heading','title',section->>'heading'));
        end if;
        if jsonb_typeof(coalesce(section->'body','[]'::jsonb)) = 'array' then
          for body in select jsonb_array_elements_text(coalesce(section->'body','[]'::jsonb)) loop
            converted := converted || jsonb_build_array(jsonb_build_object('id',md5(key||':body:'||idx||':'||body),'type','richtext','html','<p>'||replace(replace(replace(body,'&','&amp;'),'<','&lt;'),'>','&gt;')||'</p>'));
          end loop;
        end if;
        if jsonb_typeof(coalesce(section->'bullets','[]'::jsonb)) = 'array' then
          for body in select jsonb_array_elements_text(coalesce(section->'bullets','[]'::jsonb)) loop
            converted := converted || jsonb_build_array(jsonb_build_object('id',md5(key||':bullet:'||idx||':'||body),'type','richtext','html','<p>• '||replace(replace(replace(body,'&','&amp;'),'<','&lt;'),'>','&gt;')||'</p>'));
          end loop;
        end if;
      end loop;
    end if;
    source_blocks := converted;
  end if;

  insert into public.content_documents (content_key,content_type,country_slug,topic_slug,slug,title,excerpt,html,blocks,seo_title,seo_description,indexable,published,settings,created_at,updated_at)
  values (key,'country-topic',country_slug,canonical_slug,canonical_slug,new.title,coalesce(new.intro->>0,''),'',source_blocks,new.meta_title,new.meta_description,coalesce(new.indexable,true),true,jsonb_build_object('legacyCountryBestForId',new.id),now(),now())
  on conflict (content_key) do update set
    slug=excluded.slug,
    title=excluded.title,
    excerpt=case when coalesce(excluded.excerpt,'')<>'' then excluded.excerpt else public.content_documents.excerpt end,
    seo_title=coalesce(nullif(excluded.seo_title,''),public.content_documents.seo_title),
    seo_description=coalesce(nullif(excluded.seo_description,''),public.content_documents.seo_description),
    published=true,
    indexable=excluded.indexable,
    updated_at=now(),
    blocks=case when jsonb_array_length(coalesce(public.content_documents.blocks,'[]'::jsonb)) > 0 then public.content_documents.blocks else excluded.blocks end;
  return new;
end;
$$;

drop trigger if exists sync_legacy_country_best_for_to_topic_content on public.country_best_for;
create trigger sync_legacy_country_best_for_to_topic_content
after insert or update of sections, title, intro, faqs, meta_title, meta_description, intent_id, country_id on public.country_best_for
for each row execute function public.sync_legacy_country_best_for_to_canonical_topic_content();

update public.country_best_for set title=title;
