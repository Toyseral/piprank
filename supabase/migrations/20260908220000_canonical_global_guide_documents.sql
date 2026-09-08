create or replace function public.sync_guide_to_canonical_content_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  key text := 'guide:' || new.slug;
  blocks jsonb := coalesce(new.blocks, '[]'::jsonb);
  section jsonb;
  paragraph text;
  idx int := 0;
  out_blocks jsonb := '[]'::jsonb;
begin
  if jsonb_array_length(blocks) = 0 and jsonb_typeof(coalesce(new.sections,'[]'::jsonb)) = 'array' then
    for section in select jsonb_array_elements(coalesce(new.sections,'[]'::jsonb)) loop
      idx := idx + 1;
      if coalesce(section->>'heading','') <> '' then
        out_blocks := out_blocks || jsonb_build_array(jsonb_build_object('id',md5(key||':h:'||idx),'type','heading','level',2,'html','<h2>'||replace(replace(replace(section->>'heading','&','&amp;'),'<','&lt;'),'>','&gt;')||'</h2>'));
      end if;
      if jsonb_typeof(coalesce(section->'body','[]'::jsonb)) = 'array' then
        for paragraph in select jsonb_array_elements_text(coalesce(section->'body','[]'::jsonb)) loop
          out_blocks := out_blocks || jsonb_build_array(jsonb_build_object('id',md5(key||':p:'||idx||':'||paragraph),'type','richtext','html','<p>'||replace(replace(replace(paragraph,'&','&amp;'),'<','&lt;'),'>','&gt;')||'</p>'));
        end loop;
      end if;
      if jsonb_typeof(coalesce(section->'bullets','[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(section->'bullets','[]'::jsonb)) > 0 then
        out_blocks := out_blocks || jsonb_build_array(jsonb_build_object('id',md5(key||':ul:'||idx),'type','richtext','html','<ul>' || (select string_agg('<li>'||replace(replace(replace(x,'&','&amp;'),'<','&lt;'),'>','&gt;')||'</li>','') from jsonb_array_elements_text(section->'bullets') x) || '</ul>'));
      end if;
    end loop;
    blocks := out_blocks;
  end if;

  insert into public.content_documents (content_key,content_type,country_slug,topic_slug,slug,title,excerpt,html,blocks,seo_title,seo_description,indexable,published,settings,created_at,updated_at)
  values (key,'guide',null,null,new.slug,new.title,coalesce(new.excerpt,''),'',coalesce(blocks,'[]'::jsonb),null,null,true,(new.published is not null),jsonb_build_object('legacyGuideId',new.id,'category',new.category,'level',new.level,'minutes',new.minutes,'image',new.image),now(),now())
  on conflict (content_key) do update set
    title=excluded.title,
    excerpt=excluded.excerpt,
    published=excluded.published,
    settings=excluded.settings,
    blocks=case when jsonb_array_length(coalesce(public.content_documents.blocks,'[]'::jsonb)) > 0 then public.content_documents.blocks else excluded.blocks end,
    updated_at=now();
  return new;
end;
$$;

drop trigger if exists sync_guide_to_canonical_content_document on public.guides;
create trigger sync_guide_to_canonical_content_document
after insert or update of slug,title,excerpt,category,level,minutes,image,sections,blocks,published on public.guides
for each row execute function public.sync_guide_to_canonical_content_document();

revoke execute on function public.sync_guide_to_canonical_content_document() from public, anon, authenticated;

update public.guides set title=title;
