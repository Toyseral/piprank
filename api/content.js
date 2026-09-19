import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const CONTENT_WRITE = ['super_admin', 'admin', 'content_admin'];
const SITE_ORIGIN = 'https://piprank.com';

function slugify(value) { return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
const CANONICAL_INTENT_SLUGS = {
  beginners: 'forex-brokers-for-beginners',
  'low-spread': 'low-spread-forex-brokers',
  gold: 'gold-forex-brokers',
  crypto: 'crypto-brokers',
  'eur-usd': 'eur-usd-forex-brokers',
  mt4: 'mt4-forex-brokers',
  mt5: 'mt5-forex-brokers',
  ecn: 'ecn-forex-brokers',
  'copy-trading': 'copy-trading-forex-brokers',
  scalping: 'forex-brokers-for-scalping',
  'swing-trading': 'forex-brokers-for-swing-trading',
  'high-leverage': 'high-leverage-forex-brokers',
  islamic: 'islamic-forex-brokers',
};
const canonicalIntentSlug = (slug) => CANONICAL_INTENT_SLUGS[String(slug)] || String(slug);

function stripHtmlText(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalIntentResponse(intent, document) {
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  const intro = blocks
    .filter((b) => b && b.type === 'richtext' && typeof b.html === 'string')
    .map((b) => stripHtmlText(b.html))
    .filter(Boolean)
    .slice(0, 2);

  return {
    id: intent.id,
    slug: intent.slug,
    label: intent.label,
    icon: intent.icon,
    sort_order: intent.sort_order ?? 0,
    // Compatibility read model only. These values come from the canonical
    // content_documents record; intents no longer own editorial fields.
    title: document?.title || `Best Forex Brokers for ${intent.label}`,
    meta_title: document?.seo_title ?? null,
    meta_description: document?.seo_description ?? null,
    intro,
    indexable: document?.indexable ?? true,
  };
}

async function handleIntents(req,res){
  if(req.method==='GET'){
    const {slug}=req.query;
    let query=supabase.from('intents').select('id,slug,label,icon,sort_order').order('sort_order',{ascending:true}).order('id',{ascending:true});
    if(slug) query=query.eq('slug',slug).limit(1);
    const {data:intents,error}=await query;
    if(error) throw error;
    const requestedCanonicalSlug = slug ? canonicalIntentSlug(slug) : null;
    if(requestedCanonicalSlug && !intents?.[0]) return res.status(404).json({error:'Category not found'});

    // Expose exactly one canonical intent per global Best-For owner. Legacy short
    // intent aliases are accepted only at the API boundary and are not stored.
    const canonicalRows = new Map();
    for (const intent of (intents ?? [])) {
      const canonicalSlug = canonicalIntentSlug(intent.slug);
      if (!canonicalSlug) continue;
      const existing = canonicalRows.get(canonicalSlug);
      if (!existing || intent.slug === canonicalSlug) canonicalRows.set(canonicalSlug, intent);
    }
    const rows = [...canonicalRows.values()].sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)||Number(a.id)-Number(b.id));
    const slugs=rows.map((i)=>canonicalIntentSlug(i.slug)).filter(Boolean);
    const {data:docs,error:docError}=slugs.length
      ? await supabase.from('content_documents')
          .select('content_key,slug,title,blocks,seo_title,seo_description,indexable,published')
          .eq('content_type','global-best-for')
          .in('slug',slugs)
      : {data:[],error:null};
    if(docError) throw docError;
    const bySlug=new Map((docs??[]).map((d)=>[d.slug,d]));
    const result=rows.map((intent)=>canonicalIntentResponse(intent,bySlug.get(canonicalIntentSlug(intent.slug))));
    return requestedCanonicalSlug ? res.status(200).json(result[0]) : res.status(200).json(result);
  }

  if(!(await requireRole(req,res,CONTENT_WRITE)))return;

  const taxonomyKeys=['label','icon','sort_order'];
  if(req.method==='POST'){
    return res.status(410).json({
      error:'Direct intent creation is retired. Create a canonical global Best-For owner instead; its intent is created automatically.'
    });
  }

  if(req.method==='PUT'){
    const {id,...body}=req.body??{};
    if(!id)return res.status(400).json({error:'id is required'});
    const fields={};
    for(const key of taxonomyKeys) if(body[key]!==undefined) fields[key]=key==='label'?String(body[key]).trim():key==='icon'?String(body[key]):Number(body[key]);
    if(fields.label!==undefined && fields.label.length<2)return res.status(400).json({error:'Label is required'});
    const {data,error}=await supabase.from('intents').update(fields).eq('id',Number(id)).select('id,slug,label,icon,sort_order').single();
    if(error)throw error;
    return res.status(200).json(canonicalIntentResponse(data,null));
  }

  if(req.method==='DELETE'){
    const {id}=req.body??{};
    if(!id)return res.status(400).json({error:'id is required'});
    const {data:intent,error:findError}=await supabase.from('intents').select('slug').eq('id',Number(id)).maybeSingle();
    if(findError)throw findError;
    if(!intent)return res.status(404).json({error:'Category not found'});
    const {error}=await supabase.from('intents').delete().eq('id',Number(id));
    if(error)throw error;
    const {error:docError}=await supabase.from('content_documents').delete().eq('content_key',`best-for:${canonicalIntentSlug(intent.slug)}`).eq('content_type','global-best-for');
    if(docError)throw docError;
    return res.status(200).json({ok:true});
  }

  return res.status(405).json({error:'Method not allowed'});
}
function isMissingPublishingStateColumn(error){return error&&(error.code==='PGRST204'||/publishing_state/i.test(String(error.message||error.details||'')));}
async function insertCountryWithPublishingFallback(payload){const result=await supabase.from('countries').insert(payload).select().single();if(!result.error||!isMissingPublishingStateColumn(result.error))return result;const {publishing_state,...safePayload}=payload;return supabase.from('countries').insert(safePayload).select().single();}
async function updateCountryWithPublishingFallback(id,fields){const result=await supabase.from('countries').update(fields).eq('id',Number(id)).select().single();if(!result.error||!isMissingPublishingStateColumn(result.error))return result;const {publishing_state,...safeFields}=fields;return supabase.from('countries').update(safeFields).eq('id',Number(id)).select().single();}
async function handleCountries(req,res){
  if(req.method==='GET'){
    const {slug}=req.query;
    const {data:countries,error}=slug
      ? await supabase.from('countries').select('*').eq('slug',slug).single().then((r)=>({data:r.data?[r.data]:[],error:r.error}))
      : await supabase.from('countries').select('*').order('id',{ascending:true});
    if(error) return res.status(404).json({error:'Country not found'});
    if(slug){if(!countries?.[0])return res.status(404).json({error:'Country not found'});return res.status(200).json(countries[0]);}
    return res.status(200).json(countries ?? []);
  }
  if(!(await requireRole(req,res,CONTENT_WRITE)))return;
  if(req.method==='POST'){const body=req.body??{};if(!body.name||String(body.name).trim().length<2)return res.status(400).json({error:'Country name is required'});const payload={name:String(body.name).trim().slice(0,60),slug:body.slug?slugify(body.slug):slugify(body.name),flag:String(body.flag??'🌍').slice(0,8),publishing_state:['draft','published','closed'].includes(body.publishing_state)?body.publishing_state:'draft'};const {data,error}=await insertCountryWithPublishingFallback(payload);if(error)throw error;return res.status(201).json(data);}
  if(req.method==='PUT'){const body=req.body??{};const id=Number(body.id);if(!id)return res.status(400).json({error:'id is required'});const fields={};if(body.name!==undefined)fields.name=String(body.name).trim().slice(0,60);if(body.slug!==undefined)fields.slug=slugify(body.slug);else if(fields.name)fields.slug=slugify(fields.name);if(body.flag!==undefined)fields.flag=String(body.flag).slice(0,8);if(body.publishing_state!==undefined&&['draft','published','closed'].includes(body.publishing_state))fields.publishing_state=body.publishing_state;const {data,error}=await updateCountryWithPublishingFallback(id,fields);if(error)throw error;return res.status(200).json(data);}
  if(req.method==='DELETE'){const {id}=req.body??{};if(!id)return res.status(400).json({error:'id is required'});const {error}=await supabase.from('countries').delete().eq('id',Number(id));if(error)throw error;return res.status(200).json({ok:true});}
  return res.status(405).json({error:'Method not allowed'});
}
function cleanStringArray(value){return Array.isArray(value)?value.map(String).map(x=>x.trim()).filter(Boolean):[];}
function cleanSections(value){if(!Array.isArray(value))return [];if(value.some((s)=>s&&typeof s==='object'&&typeof s.type==='string')) return value.map((s)=>s&&typeof s==='object'?{...s}:s).filter(Boolean);return value.map((s)=>({heading:String(s?.heading??'').trim(),body:cleanStringArray(s?.body),bullets:cleanStringArray(s?.bullets)})).filter(s=>s.heading||s.body.length||s.bullets.length);}
function cleanFaqs(value){if(!Array.isArray(value))return [];return value.map(f=>({q:String(f?.q??'').trim(),a:String(f?.a??'').trim()})).filter(f=>f.q&&f.a);}
function cleanHtml(input=''){let html=String(input);html=html.replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi,'');html=html.replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select)[^>]*\/?>/gi,'');html=html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,'');html=html.replace(/javascript\s*:/gi,'');return html.trim();}
function cleanBlocks(blocks){if(!Array.isArray(blocks))return [];return blocks.map(b=>b&&typeof b==='object'&&typeof b.html==='string'?{...b,html:cleanHtml(b.html)}:b);}
function normalizeContentDoc(body){const contentType=String(body.content_type||'page').slice(0,40);const countrySlug=body.country_slug?slugify(body.country_slug):null;const topicSlug=body.topic_slug?slugify(body.topic_slug):null;const slug=body.slug?slugify(body.slug):(topicSlug||slugify(body.title||body.content_key||'')||null);const contentKey=String(body.content_key||[contentType,countrySlug,topicSlug,slug].filter(Boolean).join(':')).slice(0,180);return{content_key:contentKey,content_type:contentType,country_slug:countrySlug,topic_slug:topicSlug,slug,title:String(body.title||'').slice(0,180),excerpt:String(body.excerpt||'').slice(0,600),html:cleanHtml(body.html||''),blocks:cleanBlocks(Array.isArray(body.blocks)?body.blocks:[]),settings:body.settings&&typeof body.settings==='object'&&!Array.isArray(body.settings)?body.settings:{},seo_title:body.seo_title?String(body.seo_title).slice(0,180):null,seo_description:body.seo_description?String(body.seo_description).slice(0,320):null,indexable:body.indexable===undefined?true:Boolean(body.indexable),published:body.published===undefined?true:Boolean(body.published)};}
async function handleContentAssets(req,res){if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});const actor=await requireRole(req,res,CONTENT_WRITE);if(!actor)return;const {filename,contentType,dataBase64}=req.body||{};if(!filename||!dataBase64)return res.status(400).json({error:'filename and dataBase64 are required'});const safeName=String(filename).toLowerCase().replace(/[^a-z0-9._-]+/g,'-').slice(-120);const type=String(contentType||'image/jpeg');if(!/^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(type))return res.status(400).json({error:'Only JPEG, PNG, WebP, GIF or SVG images are allowed'});const raw=String(dataBase64).replace(/^data:[^;]+;base64,/,'');const buffer=Buffer.from(raw,'base64');if(buffer.length>4*1024*1024)return res.status(413).json({error:'Image must be 4 MB or smaller'});const path=`content/${Date.now()}-${safeName}`;const {error}=await supabase.storage.from('content-media').upload(path,buffer,{contentType:type,upsert:false});if(error)throw error;const {data}=supabase.storage.from('content-media').getPublicUrl(path);return res.status(201).json({url:data.publicUrl,uploaded_by:actor.email});}
const TOPICS = {
  'eur-usd-forex-brokers': { key: 'eur-usd', title: 'EUR/USD Forex Brokers', short: 'EUR/USD', criteria: 'EUR/USD trading' },
  'gold-forex-brokers': { key: 'gold', title: 'Gold Forex Brokers', short: 'Gold', criteria: 'gold and commodity trading' },
  'crypto-brokers': { key: 'crypto', title: 'Crypto Forex Brokers', short: 'Crypto', criteria: 'crypto trading' },
  'mt4-forex-brokers': { key: 'mt4', title: 'MT4 Forex Brokers', short: 'MT4', criteria: 'MetaTrader 4 trading' },
  'mt5-forex-brokers': { key: 'mt5', title: 'MT5 Forex Brokers', short: 'MT5', criteria: 'MetaTrader 5 trading' },
  'low-spread-forex-brokers': { key: 'low-spread', title: 'Low Spread Forex Brokers', short: 'Low Spread', criteria: 'competitive EUR/USD spreads' },
  'forex-brokers-for-beginners': { key: 'beginners', title: 'Forex Brokers for Beginners', short: 'Beginners', criteria: 'beginner-friendly trading' },
  'forex-brokers-for-scalping': { key: 'scalping', title: 'Forex Brokers for Scalping', short: 'Scalping', criteria: 'scalping' },
  'islamic-forex-brokers': { key: 'islamic', title: 'Islamic Forex Brokers', short: 'Islamic / Swap-Free', criteria: 'Islamic or swap-free accounts' },
  'copy-trading-forex-brokers': { key: 'copy-trading', title: 'Copy Trading Forex Brokers', short: 'Copy Trading', criteria: 'copy trading' },
  'ecn-forex-brokers': { key: 'ecn', title: 'ECN Forex Brokers', short: 'ECN', criteria: 'ECN-style accounts' },
  'forex-brokers-for-swing-trading': { key: 'swing-trading', title: 'Forex Brokers for Swing Trading', short: 'Swing Trading', criteria: 'swing trading' },
  'high-leverage-forex-brokers': { key: 'high-leverage', title: 'High Leverage Forex Brokers', short: 'High Leverage', criteria: 'high-leverage trading' },
};

function matches(b, key) {
  const platforms = Array.isArray(b.platforms)
    ? b.platforms.map((p) => String(p?.name ?? p).toLowerCase())
    : [];
  const checks = {
    'eur-usd': () => Number.isFinite(Number(b.spread_eurusd)) && Number(b.spread_eurusd) >= 0,
    gold: () => Number(b.assets?.commodities ?? 0) > 0,
    crypto: () => Number(b.assets?.crypto ?? 0) > 0,
    mt4: () => platforms.includes('mt4'),
    mt5: () => platforms.includes('mt5'),
    'low-spread': () => Number.isFinite(Number(b.spread_eurusd)),
    beginners: () => Boolean(b.demo_account) || Number(b.min_deposit ?? 999999) <= 100 || (b.best_for ?? []).includes('beginners'),
    scalping: () => Boolean(b.scalping),
    islamic: () => Boolean(b.islamic_account),
    'copy-trading': () => Boolean(b.copy_trading),
    ecn: () => (b.account_types ?? []).some((a) => /ecn/i.test(String(a))),
    'swing-trading': () => (b.best_for ?? []).includes('swing-trading'),
    'high-leverage': () => (b.best_for ?? []).includes('high-leverage'),
  };
  return Boolean(checks[key]?.());
}

function makeBlocks(country,topic,qualifying){const brokerNames=qualifying.slice(0,5).map(b=>b.name).join(', ');const uid=()=>`b_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;const richtext=html=>({id:uid(),type:'richtext',html});const heading=title=>({id:uid(),type:'heading',title});const bullets=items=>`<ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul>`;return[heading(`Best ${topic.title} in ${country.name}`),richtext(`<p>This PipRank page compares ${topic.title.toLowerCase()} available to traders in ${country.name}. The shortlist starts with brokers recommended for ${country.name}, then applies the ${topic.criteria} criteria for this page.</p>`),richtext(`<p>Broker availability, legal entities, spreads, leverage, payment methods and account conditions can differ by country. Always confirm the current terms that apply to residents of ${country.name} before opening an account.</p>`),heading(`What to look for when choosing a ${topic.short} broker in ${country.name}`),richtext(bullets(['Availability to residents of the country',`Competitive conditions for ${topic.criteria}`,'Relevant regulation and client protections','Platforms and account types that fit your trading style','Deposits, withdrawals and fees that work for your market'])),heading('PipRank broker shortlist'),richtext(`<p>${qualifying.length?`The current qualifying broker pool includes ${brokerNames}${qualifying.length>5?' and other eligible brokers.':'.'}`:'No broker currently meets the page eligibility threshold. Review the broker data before publishing this page.'}</p>`),heading('Is this page right for you?'),richtext(`<p>Use the comparison above if your priority is ${topic.criteria}. If your needs are different, explore the other broker categories for ${country.name} or use PipRank BrokerMatch to get a recommendation based on your preferences.</p>`)];}
function makeFaqs(country,topic){return[{q:`What are the best ${topic.short} forex brokers in ${country.name}?`,a:`PipRank starts with brokers recommended for traders in ${country.name}, then filters them against the ${topic.criteria} criteria. The best choice can still depend on your trading style, costs, platform and account preferences.`},{q:`How does PipRank rank ${topic.short.toLowerCase()} brokers in ${country.name}?`,a:`We first establish the country-specific broker pool, then apply the page criteria and compare relevant broker data such as spreads, platforms, account features, minimum deposits and overall broker quality.`},{q:`Can forex broker conditions differ in ${country.name}?`,a:`Yes. The legal entity, regulator, leverage, payment methods, account types and available instruments can differ by country. Confirm the current terms for residents of ${country.name} before opening an account.`}];}
async function handleSeoPageGenerator(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const actor = await requireRole(req, res, CONTENT_WRITE);
  if (!actor) return;

  const countrySlug = slugify(req.body?.country_slug || '');
  const topicSlug = slugify(req.body?.topic_slug || '');
  const topic = TOPICS[topicSlug];
  if (!countrySlug || !topic) {
    return res.status(400).json({ error: 'Valid country_slug and canonical topic_slug are required' });
  }

  // Country Best-For pages must map to one of the 13 canonical global intents.
  // Combination/legacy topics are not independent content owners.
  const canonicalTopicSlugs = new Set(Object.values(CANONICAL_INTENT_SLUGS));
  if (!canonicalTopicSlugs.has(topicSlug)) {
    return res.status(400).json({ error: 'Only canonical global Best-For intents can generate country Best-For pages' });
  }

  const [{ data: country, error: ce }, { data: brokers, error: be }, { data: existing, error: xe }] = await Promise.all([
    supabase.from('countries').select('*').eq('slug', countrySlug).maybeSingle(),
    supabase.from('brokers').select('*'),
    supabase.from('content_documents').select('id,content_key').eq('content_key', `country-best-for:${countrySlug}:${topicSlug}`).maybeSingle(),
  ]);
  if (ce) throw ce;
  if (be) throw be;
  if (xe) throw xe;
  if (!country) return res.status(404).json({ error: `Country not found: ${countrySlug}` });
  if (existing) return res.status(409).json({ error: 'This canonical country Best-For page already exists', document: existing });

  const { data: intent, error: intentError } = await supabase.from('intents')
    .select('id,slug')
    .eq('slug', topicSlug)
    .maybeSingle();
  if (intentError) throw intentError;
  if (!intent) return res.status(400).json({ error: 'Canonical intent is not configured' });

  const { data: rankings, error: rankingError } = await supabase.from('country_intent_broker_final_rankings')
    .select('broker_id,final_rank,eligibility_status')
    .eq('country_id', Number(country.id))
    .eq('intent_id', Number(intent.id));
  if (rankingError) throw rankingError;

  const qualifyingIds = new Set(
    (rankings ?? [])
      .filter((row) => String(row.eligibility_status ?? '').toLowerCase() === 'eligible')
      .map((row) => Number(row.broker_id))
      .filter(Number.isInteger)
  );
  const qualifying = (brokers || []).filter((b) => qualifyingIds.has(Number(b.id)));
  const minBrokers = 2;
  const eligible = qualifying.length >= minBrokers;
  const year = new Date().getFullYear();
  const title = `${topic.title} in ${country.name}`;
  const blocks = makeBlocks(country, topic, qualifying);
  const faqs = makeFaqs(country, topic);
  const payload = {
    content_key: `country-best-for:${countrySlug}:${topicSlug}`,
    content_type: 'country-best-for',
    country_slug: countrySlug,
    topic_slug: topicSlug,
    slug: topicSlug,
    title,
    excerpt: `Compare ${topic.title.toLowerCase()} available to traders in ${country.name}.`,
    html: '',
    blocks,
    seo_title: `Best ${topic.title} in ${country.name} ${year} | PipRank`,
    seo_description: `Compare ${topic.title.toLowerCase()} available to traders in ${country.name}, including country-specific broker recommendations, costs, platforms and key trading features.`,
    indexable: eligible,
    published: false,
    settings: {
      rankingMode: 'auto',
      pinnedBrokerSlugs: [],
      excludedBrokerSlugs: [],
      faqs,
      internalLinks: [
        { label: `Best Forex Brokers in ${country.name}`, href: `/${countrySlug}` },
        { label: 'Find My Best Broker', href: '/quiz' },
      ],
      generator: {
        version: 3,
        generatedAt: new Date().toISOString(),
        qualifyingBrokerCount: qualifying.length,
        minBrokers,
        eligibleForIndexing: eligible,
        actor: actor.email,
      },
    },
    updated_by: actor.email,
  };
  const { data, error } = await supabase.from('content_documents').insert(payload).select().single();
  if (error) {
    if (error.code === '23505') {
      const { data: duplicate } = await supabase.from('content_documents').select('id,content_key').eq('content_key', payload.content_key).maybeSingle();
      return res.status(409).json({ error: 'This canonical country Best-For page already exists', document: duplicate || null });
    }
    throw error;
  }
  return res.status(201).json({ document: data, qualifyingBrokerCount: qualifying.length, eligibleForIndexing: eligible });
}
const LOCALIZATION_TOPICS=[{key:'all',defaultSlug:'best-forex-brokers',defaultTitle:'Best Forex Brokers'},{key:'beginners',defaultSlug:'best-forex-brokers-for-beginners',defaultTitle:'Best Forex Brokers for Beginners'},{key:'mt4',defaultSlug:'best-mt4-brokers',defaultTitle:'Best MT4 Forex Brokers'},{key:'mt5',defaultSlug:'best-mt5-brokers',defaultTitle:'Best MT5 Forex Brokers'},{key:'gold',defaultSlug:'best-gold-brokers',defaultTitle:'Best Gold Forex Brokers'},{key:'low-spread',defaultSlug:'low-spread-forex-brokers',defaultTitle:'Low Spread Forex Brokers'}];
const MIN_LOCALIZED_CONTENT_LENGTH=40;
const LANGUAGE_TOPIC_TEMPLATES={vi:{all:{slug:'broker-forex-tot-nhat',title:'Broker Forex Tốt Nhất'},beginners:{slug:'broker-forex-tot-nhat-cho-nguoi-moi',title:'Broker Forex Tốt Nhất Cho Người Mới'},mt4:{slug:'broker-mt4-tot-nhat',title:'Broker MT4 Tốt Nhất'},mt5:{slug:'broker-mt5-tot-nhat',title:'Broker MT5 Tốt Nhất'},gold:{slug:'broker-giao-dich-vang-tot-nhat',title:'Broker Forex Tốt Nhất Để Giao Dịch Vàng'},'low-spread':{slug:'broker-forex-spread-thap',title:'Broker Forex Có Spread Thấp'}},ms:{all:{slug:'broker-forex-terbaik',title:'Broker Forex Terbaik'},beginners:{slug:'broker-forex-untuk-pemula',title:'Broker Forex untuk Pemula'},mt4:{slug:'broker-mt4-terbaik',title:'Broker MT4 Terbaik'},mt5:{slug:'broker-mt5-terbaik',title:'Broker MT5 Terbaik'},gold:{slug:'broker-emas-terbaik',title:'Broker Emas Terbaik'},'low-spread':{slug:'broker-spread-rendah',title:'Broker Forex Spread Rendah'}}};
function templateFor(languageCode,topicKey,countryName,fallbackSlug,fallbackTitle){const pack=LANGUAGE_TOPIC_TEMPLATES[String(languageCode||'').toLowerCase()]||{};const t=pack[topicKey];if(t){const joiner=String(languageCode).toLowerCase()==='vi'?' tại ':' di ';const title=countryName&&!t.title.includes(countryName)?`${t.title}${joiner}${countryName}`:t.title;return{slug:t.slug,title};}const title=countryName?`${fallbackTitle} in ${countryName}`:fallbackTitle;return{slug:fallbackSlug,title};}
async function handleCountryLanguages(req,res){if(req.method==='GET'){const {country,admin}=req.query;if(admin==='true'){const actor=await requireRole(req,res,CONTENT_WRITE);if(!actor)return;}let query=supabase.from('country_languages').select('*, countries!inner(name,slug)').order('id',{ascending:true});if(country)query=query.eq('countries.slug',country);if(admin!=='true')query=query.eq('active',true);const {data,error}=await query;if(error)throw error;return res.status(200).json((data??[]).map(r=>({...r,country_name:r.countries?.name,country_slug:r.countries?.slug,countries:undefined})));}const actor=await requireRole(req,res,CONTENT_WRITE);if(!actor)return;if(req.method==='POST'){const b=req.body??{};if(!b.country_id||!b.name||!b.native_name||!b.code||!b.locale)return res.status(400).json({error:'country_id, name, native_name, code and locale are required'});const payload={country_id:Number(b.country_id),name:String(b.name).trim().slice(0,80),native_name:String(b.native_name).trim().slice(0,80),code:String(b.code).trim().toLowerCase().slice(0,10),locale:String(b.locale).trim().slice(0,20),url_prefix:slugify(b.url_prefix||b.code).slice(0,20),is_default:Boolean(b.is_default),active:b.active===undefined?true:Boolean(b.active),updated_by:actor.email};const {data:lang,error}=await supabase.from('country_languages').insert(payload).select().single();if(error)throw error;const country=await supabase.from('countries').select('name,slug').eq('id',payload.country_id).single();return res.status(201).json({language:lang,country:country.data??null});}if(req.method==='PUT'){const b=req.body??{};if(!b.id)return res.status(400).json({error:'id is required'});const fields={};for(const k of ['name','native_name','code','locale','url_prefix','is_default','active'])if(b[k]!==undefined)fields[k]=b[k];if(fields.code)fields.code=String(fields.code).toLowerCase().trim();if(fields.url_prefix)fields.url_prefix=slugify(fields.url_prefix).slice(0,20);fields.updated_by=actor.email;const {data,error}=await supabase.from('country_languages').update(fields).eq('id',Number(b.id)).select().single();if(error)throw error;return res.status(200).json(data);}if(req.method==='DELETE'){const {id}=req.body??{};if(!id)return res.status(400).json({error:'id is required'});const {error}=await supabase.from('country_languages').delete().eq('id',Number(id));if(error)throw error;return res.status(200).json({ok:true});}return res.status(405).json({error:'Method not allowed'});}
const DEFAULT_UI_STRING_KEYS=['home','recommendations','methodologyTitle','methodologyAvailability','methodologyIntent','methodologyAffiliate','findBroker','findBrokerBlurb','insufficientData','reviewedBy'];
async function handleLocalizationUiPacks(req,res){if(req.method==='GET'){const {language}=req.query;let query=supabase.from('localization_ui_packs').select('*').order('language_code');if(language)query=query.eq('language_code',String(language).toLowerCase());const {data,error}=await query;if(error){if(String(error.message||'').includes('does not exist'))return res.status(200).json(language?null:[]);throw error;}if(language)return res.status(200).json(data?.[0]??null);return res.status(200).json(data??[]);}const actor=await requireRole(req,res,CONTENT_WRITE);if(!actor)return;if(req.method==='POST'||req.method==='PUT'){const b=req.body??{};const code=String(b.language_code||'').trim().toLowerCase().slice(0,10);if(!code)return res.status(400).json({error:'language_code is required'});const strings=b.strings&&typeof b.strings==='object'?b.strings:{};const row={language_code:code,strings,updated_by:actor.email,updated_at:new Date().toISOString()};const {data,error}=await supabase.from('localization_ui_packs').upsert(row,{onConflict:'language_code'}).select().single();if(error)throw error;return res.status(200).json(data);}if(req.method==='DELETE'){const code=String(req.body?.language_code||req.query?.language||'').toLowerCase();if(!code)return res.status(400).json({error:'language_code is required'});const {error}=await supabase.from('localization_ui_packs').delete().eq('language_code',code);if(error)throw error;return res.status(200).json({ok:true});}return res.status(405).json({error:'Method not allowed'});}
async function handleLocalizationGlossary(req,res){if(req.method==='GET'){const {language}=req.query;let query=supabase.from('localization_glossary').select('*').order('term_en');if(language)query=query.eq('language_code',String(language).toLowerCase());const {data,error}=await query;if(error){if(String(error.message||'').includes('does not exist'))return res.status(200).json([]);throw error;}return res.status(200).json(data??[]);}const actor=await requireRole(req,res,CONTENT_WRITE);if(!actor)return;if(req.method==='POST'){const b=req.body??{};const language_code=String(b.language_code||'').trim().toLowerCase().slice(0,10);const term_en=String(b.term_en||'').trim().slice(0,120);const term_local=String(b.term_local||'').trim().slice(0,120);if(!language_code||!term_en||!term_local)return res.status(400).json({error:'language_code, term_en and term_local are required'});const {data,error}=await supabase.from('localization_glossary').upsert({language_code,term_en,term_local,notes:b.notes?String(b.notes).slice(0,300):null,updated_by:actor.email},{onConflict:'language_code,term_en'}).select().single();if(error)throw error;return res.status(201).json(data);}if(req.method==='PUT'){const b=req.body??{};if(!b.id)return res.status(400).json({error:'id is required'});const fields={updated_by:actor.email};for(const k of ['term_en','term_local','notes','language_code'])if(b[k]!==undefined)fields[k]=b[k];const {data,error}=await supabase.from('localization_glossary').update(fields).eq('id',Number(b.id)).select().single();if(error)throw error;return res.status(200).json(data);}if(req.method==='DELETE'){const id=req.body?.id;if(!id)return res.status(400).json({error:'id is required'});const {error}=await supabase.from('localization_glossary').delete().eq('id',Number(id));if(error)throw error;return res.status(200).json({ok:true});}
  return res.status(405).json({error:'Method not allowed'});
}
async function handleLocalizationHealth(req,res){if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});const actor=await requireRole(req,res,CONTENT_WRITE);if(!actor)return;const {data:docs,error}=await supabase.from('content_documents').select('id,country_slug,content_type,slug,title,blocks,html,seo_description,published,indexable,updated_at').in('content_type',['localized-guide','localized-best-for']);if(error)throw error;const issues=[];for(const p of docs??[]){const contentLen=String(p.html||'').trim().length;const blockCount=Array.isArray(p.blocks)?p.blocks.length:0;if(p.published&&contentLen<MIN_LOCALIZED_CONTENT_LENGTH&&blockCount<1)issues.push({id:p.id,type:'thin_published',message:'Published localized document has thin content',slug:p.slug,country:p.country_slug});if(p.published&&p.indexable&&!String(p.seo_description||'').trim())issues.push({id:p.id,type:'missing_meta',message:'Published/indexable localized document has no meta description',slug:p.slug,country:p.country_slug});}return res.status(200).json({totals:{pages:(docs??[]).length,published:(docs??[]).filter(p=>p.published).length,issues:issues.length},issues});}
async function handleCountryIntentRankings(req, res) {
  const { country, intent } = req.query || {};
  if (!country || !intent) return res.status(400).json({ error: 'country and intent are required' });

  const requestedIntent = String(intent).trim().toLowerCase();
  const dbIntentSlug = canonicalIntentSlug(requestedIntent);
  const [{ data: countryRow, error: countryError }, { data: intentRow, error: intentError }] = await Promise.all([
    supabase.from('countries').select('id,slug,name').eq('slug', String(country)).maybeSingle(),
    supabase.from('intents').select('id,slug,label').eq('slug', dbIntentSlug).maybeSingle(),
  ]);
  if (countryError) throw countryError;
  if (intentError) throw intentError;
  if (!countryRow) return res.status(404).json({ error: 'Country not found' });
  if (!intentRow) return res.status(404).json({ error: 'Intent not found' });

  if (req.method === 'GET') {
    const isAdmin = String(req.query?.admin ?? '') === 'true';
    if (isAdmin && !(await requireRole(req, res, CONTENT_WRITE))) return;

    const { data: setting, error: settingError } = await supabase.from('country_intent_ranking_settings')
      .select('ranking_mode').eq('country_id', Number(countryRow.id)).eq('intent_id', Number(intentRow.id)).maybeSingle();
    if (settingError) throw settingError;
    const rankingMode = setting?.ranking_mode === 'manual' ? 'manual' : 'automatic';

    const [{ data: brokers, error: brokerError }, { data: availability, error: availabilityError }, { data: overrides, error: overrideError }, { data: baseRows, error: rankingError }] = await Promise.all([
      supabase.from('brokers').select('id,name,slug,rating,trust_score,brand_color,logo_url').order('rating', { ascending: false }),
      supabase.from('broker_country_availability').select('broker_id,status,is_available,note,priority').eq('country_id', Number(countryRow.id)),
      supabase.from('country_intent_broker_overrides').select('*').eq('country_id', Number(countryRow.id)).eq('intent_id', Number(intentRow.id)),
      supabase.from('country_intent_broker_final_rankings').select('broker_id,final_rank,final_score,eligibility_status,score_breakdown,featured').eq('country_id', Number(countryRow.id)).eq('intent_id', Number(intentRow.id)).order('final_rank', { ascending: true }),
    ]);
    if (brokerError) throw brokerError;
    if (availabilityError) throw availabilityError;
    if (overrideError) throw overrideError;
    if (rankingError) throw rankingError;

    const brokerIds = (brokers ?? []).map((b) => Number(b.id)).filter((id) => Number.isInteger(id));
    let media = [];
    if (brokerIds.length) {
      const { data, error } = await supabase.from('broker_media').select('broker_id,logo_url').in('broker_id', brokerIds);
      if (error) throw error;
      media = data ?? [];
    }
    const logoMap = new Map(media.map((m) => [Number(m.broker_id), m.logo_url ?? null]));
    const availabilityMap = new Map((availability ?? []).map((a) => [Number(a.broker_id), a]));
    const overrideMap = new Map((overrides ?? []).map((o) => [Number(o.broker_id), o]));
    const baseMap = new Map((baseRows ?? []).map((r) => [Number(r.broker_id), r]));

    const hydrated = (brokers ?? []).map((broker) => {
      const id = Number(broker.id);
      const a = availabilityMap.get(id);
      const o = overrideMap.get(id);
      const base = baseMap.get(id);
      const status = String(a?.status ?? 'available').toLowerCase();
      const explicitlyUnavailable = a?.is_available === false || ['unavailable', 'restricted'].includes(status);
      const available = !explicitlyUnavailable && status === 'available';
      const score = Number(base?.final_score ?? broker.trust_score ?? broker.rating ?? 0);
      return {
        country_id: Number(countryRow.id),
        intent_id: Number(intentRow.id),
        broker_id: id,
        final_rank: o?.manual_rank ?? base?.final_rank ?? null,
        final_score: score + Number(o?.score_adjustment ?? 0),
        eligibility_status: available ? (base?.eligibility_status ?? 'available') : status,
        score_breakdown: base?.score_breakdown ?? {},
        featured: o?.featured_override ?? base?.featured ?? false,
        force_include: Boolean(o?.force_include),
        force_exclude: Boolean(o?.force_exclude),
        manual_rank: o?.manual_rank ?? null,
        score_adjustment: Number(o?.score_adjustment ?? 0),
        featured_override: o?.featured_override ?? null,
        editorial_note: o?.editorial_note ?? null,
        availability_status: status,
        availability_note: a?.note ?? null,
        broker: { ...broker, logo_url: logoMap.get(id) ?? broker.logo_url ?? null },
      };
    }).filter((row) => !row.force_exclude && row.availability_status === 'available');

    hydrated.sort((a, b) => {
      if (rankingMode === 'manual') {
        const ar = Number.isInteger(Number(a.manual_rank)) ? Number(a.manual_rank) : 9999;
        const br = Number.isInteger(Number(b.manual_rank)) ? Number(b.manual_rank) : 9999;
        if (ar !== br) return ar - br;
      }
      const af = Number(a.final_rank ?? 9999);
      const bf = Number(b.final_rank ?? 9999);
      if (af !== bf) return af - bf;
      return Number(b.final_score) - Number(a.final_score);
    });

    if (isAdmin) {
      return res.status(200).json({ ranking_mode: rankingMode, rows: hydrated });
    }

    if (rankingMode === 'automatic') {
      const automaticPool = hydrated
        .filter((row) => baseMap.has(Number(row.broker_id)) || row.force_include)
        .sort((a, b) => Number(b.final_score) - Number(a.final_score) || Number(a.broker_id) - Number(b.broker_id));
      return res.status(200).json(automaticPool.slice(0, 9).map((r, index) => ({ ...r, final_rank: index + 1 })));
    }

    const manuallyRanked = hydrated.filter((row) => Number.isInteger(Number(row.manual_rank)) && Number(row.manual_rank) >= 1 && Number(row.manual_rank) <= 9);
    const selected = manuallyRanked.length
      ? [...manuallyRanked, ...hydrated.filter((row) => !manuallyRanked.some((m) => m.broker_id === row.broker_id))].slice(0, 9)
      : hydrated.slice(0, 9);
    return res.status(200).json(selected.map((r, index) => ({ ...r, final_rank: index + 1 })));
  }

  if (!(await requireRole(req, res, CONTENT_WRITE))) return;

  if (req.method === 'PUT' && req.body?.ranking_mode !== undefined && req.body?.broker_id === undefined) {
    const rankingMode = String(req.body.ranking_mode);
    if (rankingMode !== 'automatic' && rankingMode !== 'manual') return res.status(400).json({ error: 'ranking_mode must be automatic or manual' });
    const { data, error } = await supabase.from('country_intent_ranking_settings')
      .upsert({ country_id: Number(countryRow.id), intent_id: Number(intentRow.id), ranking_mode: rankingMode, updated_at: new Date().toISOString() }, { onConflict: 'country_id,intent_id' })
      .select().single();
    if (error) throw error;
    return res.status(200).json(data);
  }

  if (req.method === 'PUT') {
    const b = req.body ?? {};
    const brokerId = Number(b.broker_id);
    if (!countryRow.id || !intentRow.id || !brokerId) return res.status(400).json({ error: 'country_id, intent_id and broker_id are required' });
    const manualRank = b.manual_rank === null || b.manual_rank === '' ? null : Number(b.manual_rank);
    if (manualRank !== null && (!Number.isInteger(manualRank) || manualRank < 1 || manualRank > 9)) {
      return res.status(400).json({ error: 'manual_rank must be between 1 and 9' });
    }

    const { data: availability, error: availabilityError } = await supabase.from('broker_country_availability')
      .select('status,is_available').eq('country_id', Number(countryRow.id)).eq('broker_id', brokerId).maybeSingle();
    if (availabilityError) throw availabilityError;
    const availabilityStatus = String(availability?.status ?? 'available').toLowerCase();
    const brokerUnavailable = availability?.is_available === false || availabilityStatus !== 'available';
    if (brokerUnavailable && (manualRank !== null || Boolean(b.force_include))) {
      return res.status(400).json({ error: 'Unavailable or restricted brokers cannot be included or manually ranked in this country' });
    }

    if (manualRank !== null) {
      await supabase.from('country_intent_broker_overrides')
        .update({ manual_rank: null, updated_at: new Date().toISOString() })
        .eq('country_id', Number(countryRow.id))
        .eq('intent_id', Number(intentRow.id))
        .eq('manual_rank', manualRank)
        .neq('broker_id', brokerId);
    }

    const payload = {
      country_id: Number(countryRow.id),
      intent_id: Number(intentRow.id),
      broker_id: brokerId,
      force_include: Boolean(b.force_include),
      force_exclude: Boolean(b.force_exclude),
      manual_rank: manualRank,
      score_adjustment: Number(b.score_adjustment || 0),
      featured_override: b.featured_override === null || b.featured_override === '' ? null : Boolean(b.featured_override),
      editorial_note: b.editorial_note ? String(b.editorial_note).slice(0, 2000) : null,
      updated_at: new Date().toISOString(),
    };
    if (payload.force_include && payload.force_exclude) return res.status(400).json({ error: 'A broker cannot be both force included and force excluded' });
    const { data, error } = await supabase.from('country_intent_broker_overrides')
      .upsert(payload, { onConflict: 'country_id,intent_id,broker_id' }).select().single();
    if (error) throw error;
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const b = req.body ?? {};
    const { error } = await supabase.from('country_intent_broker_overrides')
      .delete().match({ country_id: Number(countryRow.id), intent_id: Number(intentRow.id), broker_id: Number(b.broker_id) });
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
function setCors(res, methods) { res.setHeader('Access-Control-Allow-Origin', SITE_ORIGIN); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); }
export default async function handler(req,res){setCors(res,'GET, POST, PUT, DELETE');if(req.method==='OPTIONS')return res.status(204).end();const resource=String(req.query?.resource??'');try{if(resource==='intents')return await handleIntents(req,res);if(resource==='countries')return await handleCountries(req,res);if(resource==='content-assets')return await handleContentAssets(req,res);if(resource==='seo-page-generator')return await handleSeoPageGenerator(req,res);if(resource==='country-languages')return await handleCountryLanguages(req,res);if(resource==='localization-ui-packs')return await handleLocalizationUiPacks(req,res);if(resource==='localization-glossary')return await handleLocalizationGlossary(req,res);if(resource==='localization-health')return await handleLocalizationHealth(req,res);if(resource==='country-intent-rankings')return await handleCountryIntentRankings(req,res);return res.status(400).json({error:"Unknown 'resource' query param"});}catch(err){console.error('content API error:',err);return res.status(500).json({error:err.message});}}