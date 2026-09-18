import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
const supabase = createClient(url, key);

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function blocksFor(country) {
  const blocks = [];
  const intro = Array.isArray(country.intro) ? country.intro.filter(Boolean).map(String) : [];
  if (intro.length) {
    blocks.push({id:'country-migration:intro',type:'richtext',html:intro.map(p=>`<p>${esc(p)}</p>`).join('')});
  }
  const sections = Array.isArray(country.seo_sections) ? country.seo_sections : [];
  for (let i=0;i<sections.length;i++) {
    const s=sections[i]||{};
    if (s.heading) blocks.push({id:`country-migration:section-heading-${i}`,type:'heading',title:String(s.heading)});
    const body=Array.isArray(s.body)?s.body.filter(Boolean).map(String):[];
    const bullets=Array.isArray(s.bullets)?s.bullets.filter(Boolean).map(String):[];
    if(body.length) blocks.push({id:`country-migration:section-body-${i}`,type:'richtext',html:body.map(p=>`<p>${esc(p)}</p>`).join('')});
    if(bullets.length) blocks.push({id:`country-migration:section-bullets-${i}`,type:'richtext',html:`<ul>${bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`});
  }
  const faqs=Array.isArray(country.seo_faqs)?country.seo_faqs:[];
  if(faqs.length) {
    blocks.push({id:'country-migration:faq-heading',type:'heading',title:'Frequently Asked Questions'});
    faqs.forEach((f,i)=>{if(f?.q&&f?.a) blocks.push({id:`country-migration:faq-${i}`,type:'richtext',html:`<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`});});
  }
  return blocks;
}

const {data:countries,error:ce}=await supabase.from('countries')
  .select('slug,name,flag,subtitle,intro,seo_title,seo_description,seo_intro,seo_sections,seo_faqs,publishing_state')
  .order('id');
if(ce) throw ce;

let created=0, enriched=0, skipped=0;
for(const country of countries||[]){
  const key=`country:${country.slug}:hub`;
  const {data:existing,error:ee}=await supabase.from('content_documents')
    .select('id,blocks,title,excerpt,seo_title,seo_description,indexable,published')
    .eq('content_key',key).maybeSingle();
  if(ee) throw ee;

  const blocks=blocksFor(country);
  if(existing){
    if(Array.isArray(existing.blocks)&&existing.blocks.length){skipped++;continue;}
    const {error}=await supabase.from('content_documents').update({
      title:existing.title||`Best Forex Brokers in ${country.name}`,
      excerpt:existing.excerpt||(country.subtitle||''),
      blocks,
      seo_title:existing.seo_title||country.seo_title||`Best Forex Brokers in ${country.name} ${new Date().getFullYear()} | PipRank`,
      seo_description:existing.seo_description||country.seo_description||null,
      indexable:existing.indexable!==false,
      published:existing.published!==false
    }).eq('id',existing.id);
    if(error) throw error;
    enriched++; continue;
  }

  const {error}=await supabase.from('content_documents').insert({
    content_key:key,content_type:'country',country_slug:country.slug,topic_slug:null,slug:country.slug,
    title:`Best Forex Brokers in ${country.name}`,
    excerpt:country.subtitle||'',
    html:'',blocks,settings:{},seo_title:country.seo_title||`Best Forex Brokers in ${country.name} ${new Date().getFullYear()} | PipRank`,
    seo_description:country.seo_description||null,indexable:true,published:country.publishing_state!=='closed'
  });
  if(error) throw error;
  created++;
}
console.log(JSON.stringify({countries:countries?.length||0,created,enriched,skipped},null,2));
