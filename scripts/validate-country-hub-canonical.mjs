import { createClient } from '@supabase/supabase-js';

if (process.env.VERCEL_ENV !== 'production' && process.env.CI !== 'true') {
  console.log('[validate-country-hub-canonical] Non-production build — skipped.');
  process.exit(0);
}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
const supabase=createClient(url,key);
const {data:countries,error:ce}=await supabase.from('countries').select('slug,publishing_state');
if(ce) throw ce;
const {data:docs,error:de}=await supabase.from('content_documents').select('content_key,country_slug,blocks,published').eq('content_type','country');
if(de) throw de;
const byKey=new Map((docs||[]).map(d=>[d.content_key,d]));
const missing=[],empty=[];
for(const c of countries||[]){
 const d=byKey.get(`country:${c.slug}:hub`);
 if(!d){missing.push(c.slug);continue;}
 if(!Array.isArray(d.blocks)||!d.blocks.length) empty.push(c.slug);
}
if(missing.length||empty.length){
 console.error('[validate-country-hub-canonical] FAILED');
 console.error(JSON.stringify({missing,empty},null,2));
 process.exit(1);
}
console.log(`[validate-country-hub-canonical] OK — ${countries?.length||0} countries have canonical hub documents.`);
