create or replace function public.sync_intents_to_canonical_best_for_docs()
returns trigger
language plpgsql
as $$
declare
  canonical_slug text;
  doc_blocks jsonb := '[]'::jsonb;
  intro_blocks jsonb := '[]'::jsonb;
  criteria_blocks jsonb := '[]'::jsonb;
  faq_blocks jsonb := '[]'::jsonb;
  p text;
  f jsonb;
begin
  canonical_slug := case new.slug
    when 'beginners' then 'forex-brokers-for-beginners'
    when 'low-spread' then 'low-spread-forex-brokers'
    when 'mt5' then 'mt5-forex-brokers'
    when 'mt4' then 'mt4-forex-brokers'
    when 'gold' then 'gold-forex-brokers'
    when 'ecn' then 'ecn-forex-brokers'
    when 'copy-trading' then 'copy-trading-forex-brokers'
    when 'scalping' then 'forex-brokers-for-scalping'
    when 'swing-trading' then 'forex-brokers-for-swing-trading'
    when 'high-leverage' then 'high-leverage-forex-brokers'
    when 'islamic' then 'islamic-forex-brokers'
    else new.slug
  end;

  select coalesce(cd.blocks, '[]'::jsonb) into doc_blocks
  from public.content_documents cd
  where cd.content_key = 'best-for:' || new.slug
  limit 1;
  doc_blocks := coalesce(doc_blocks,'[]'::jsonb);

  if jsonb_array_length(doc_blocks) = 0 then
    if jsonb_typeof(coalesce(new.intro,'[]'::jsonb)) = 'array' then
      for p in select jsonb_array_elements_text(coalesce(new.intro,'[]'::jsonb)) loop
        intro_blocks := intro_blocks || jsonb_build_array(jsonb_build_object('id', md5('intro:'||p), 'type','richtext','html','<p>' || replace(replace(replace(p,'&','&amp;'),'<','&lt;'),'>','&gt;') || '</p>'));
      end loop;
    end if;
    if jsonb_typeof(coalesce(new.criteria,'[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(new.criteria,'[]'::jsonb)) > 0 then
      criteria_blocks := jsonb_build_array(jsonb_build_object('id',md5('criteria:'||new.slug),'type','heading','level',2,'html','How we rank these brokers'));
      for p in select jsonb_array_elements_text(coalesce(new.criteria,'[]'::jsonb)) loop
        criteria_blocks := criteria_blocks || jsonb_build_array(jsonb_build_object('id',md5('criterion:'||p),'type','richtext','html','<p>✓ ' || replace(replace(replace(p,'&','&amp;'),'<','&lt;'),'>','&gt;') || '</p>'));
      end loop;
    end if;
    if jsonb_typeof(coalesce(new.faqs,'[]'::jsonb)) = 'array' then
      for f in select jsonb_array_elements(coalesce(new.faqs,'[]'::jsonb)) loop
        faq_blocks := faq_blocks || jsonb_build_array(jsonb_build_object('id',md5('faq:'||coalesce(f->>'q','')),'type','richtext','html','<h2>' || replace(replace(replace(coalesce(f->>'q',''),'&','&amp;'),'<','&lt;'),'>','&gt;') || '</h2><p>' || replace(replace(replace(coalesce(f->>'a',''),'&','&amp;'),'<','&lt;'),'>','&gt;') || '</p>'));
      end loop;
    end if;
    doc_blocks := intro_blocks || criteria_blocks || faq_blocks;
  end if;

  insert into public.content_documents (content_key,content_type,country_slug,topic_slug,slug,title,excerpt,html,blocks,seo_title,seo_description,indexable,published,settings,created_at,updated_at)
  values ('best-for:'||new.slug,'best-for',null,new.slug,canonical_slug,new.title,'','',coalesce(doc_blocks,'[]'::jsonb),null,null,coalesce(new.indexable,true),true,jsonb_build_object('legacyIntentSlug',new.slug),now(),now())
  on conflict (content_key) do update set
    slug=excluded.slug,
    title=excluded.title,
    indexable=excluded.indexable,
    published=true,
    updated_at=now(),
    blocks=case when jsonb_array_length(coalesce(public.content_documents.blocks,'[]'::jsonb)) > 0 then public.content_documents.blocks else excluded.blocks end;
  return new;
end;
$$;

drop trigger if exists sync_intent_to_canonical_best_for on public.intents;
create trigger sync_intent_to_canonical_best_for
after insert or update of slug,title,intro,criteria,faqs,indexable on public.intents
for each row execute function public.sync_intents_to_canonical_best_for_docs();

update public.intents set title=title where slug in ('beginners','low-spread','mt5','mt4','gold','ecn','copy-trading','scalping','swing-trading','high-leverage','islamic');
