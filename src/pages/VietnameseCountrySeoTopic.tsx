import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import type { Broker, CountryPage } from '../lib/types';
import { fetchBrokers, fetchCountry } from '../lib/api';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildItemListJsonLd, buildWebPageJsonLd, absoluteUrl } from '../lib/seo';
import { getCountrySeoTopic, rankCountryTopicBrokers, topicNote } from '../data/countrySeoTopics';
import { getVietnameseTopic, vietnameseRankKey, VIETNAMESE_LOCALE } from '../data/vietnameseLocalization';
import BrokerCard from '../components/BrokerCard';
import Monogram from '../components/Monogram';
import Reveal from '../components/Reveal';
import NotFound from './NotFound';
import { reviewerFor } from '../lib/team';

export default function VietnameseCountrySeoTopic() {
  const { countrySlug, topicSlug } = useParams<{ countrySlug: string; topicSlug: string }>();
  const localized = topicSlug ? getVietnameseTopic(topicSlug) : null;
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (countrySlug !== 'vietnam' || !localized) { setMissing(true); setLoading(false); return; }
    Promise.all([fetchCountry(countrySlug), fetchBrokers()])
      .then(([c, b]) => { setCountry(c); setBrokers(b); })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, [countrySlug, localized?.slug]);

  const topic = localized ? (vietnameseRankKey(localized) ? getCountrySeoTopic(vietnameseRankKey(localized)!) : null) : null;
  const ranked = useMemo((): Broker[] => {
    if (!country || !localized) return [];
    const recommended = new Set((country.recommended ?? []).map((x) => x.slug));
    const pool = brokers.filter((b) => recommended.has(b.slug));
    if (!topic) return [...pool].sort((a,b) => Number(b.rating ?? 0) - Number(a.rating ?? 0) || Number(b.trust_score ?? 0) - Number(a.trust_score ?? 0));
    return rankCountryTopicBrokers(brokers, country, topic);
  }, [country, brokers, topic, localized]);

  const year = new Date().getFullYear();
  const path = `/vietnam/vi/${localized?.slug ?? ''}`;
  const englishPath = localized?.englishTopicSlug ? `/vietnam/${localized.englishTopicSlug}` : '/vietnam';
  const reviewer = useMemo(() => reviewerFor(`vietnam-vi-${localized?.slug ?? ''}`), [localized?.slug]);
  const seo = country && localized ? { title: localized.metaTitle, description: localized.description, path, type: 'website' as const, lang: VIETNAMESE_LOCALE, alternates: [{ hreflang: 'vi-VN', path }, { hreflang: 'en-VN', path: englishPath }] } : null;
  const faqs = localized?.faqs ?? [];

  useSEO(seo, seo ? [
    { ...buildWebPageJsonLd(seo), inLanguage: VIETNAMESE_LOCALE, author: { '@type': 'Person', name: reviewer.penName, jobTitle: reviewer.role, url: absoluteUrl(`/authors#${reviewer.slug}`) } },
    buildBreadcrumbJsonLd([{ name: 'Trang chủ', path: '/' }, { name: 'Việt Nam', path: '/vietnam' }, { name: localized!.title, path }]),
    buildItemListJsonLd(localized!.title, ranked.slice(0,10).map((b) => ({ name: b.name, path: `/brokers/${b.slug}` }))),
    buildFAQPageJsonLd(faqs.map(([q,a]) => ({ question: q, answer: a }))),
  ] : undefined);

  if (missing) return <NotFound />;
  if (loading || !country || !localized) return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-52 animate-pulse rounded-3xl border border-line bg-white" /><div className="mt-8 h-64 animate-pulse rounded-3xl border border-line bg-white" /></div>;

  const englishLabel = localized.englishTopicSlug ? 'English version' : 'English country page';
  return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang="vi">
    <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-400"><Link to="/" className="hover:text-ink-900">Trang chủ</Link><span>/</span><Link to="/vietnam" className="hover:text-ink-900">Việt Nam</Link><span>/</span><span className="text-ink-900">{localized.title}</span></nav>
    <header className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 sm:p-10"><div className="absolute inset-0 bg-grid-dark" /><div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-[110px]" /><div className="relative">
      <div className="flex items-center gap-3 text-sm font-semibold text-emerald-300"><span className="text-3xl">🇻🇳</span>Việt Nam · Tiếng Việt</div>
      <h1 className="mt-5 max-w-4xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{localized.title} <span className="text-slate-500">({year})</span></h1>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400"><Monogram name={reviewer.penName} color={reviewer.color} size={20} /><span>Được đánh giá bởi <Link to={`/authors#${reviewer.slug}`} className="font-semibold text-slate-200 hover:text-emerald-300">{reviewer.penName}</Link>, {reviewer.role}</span></div>
      {localized.intro.map((p,i)=><p key={i} className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-[15px]">{p}</p>)}
      <div className="mt-6 flex flex-wrap gap-3"><Link to="/quiz" className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-ink-950 hover:bg-emerald-300"><Sparkles size={16} /> {localized.ui.find}</Link><a href="#comparison" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10">{localized.ui.compare} <ArrowRight size={15} /></a></div>
    </div></header>

    <section className="mt-8 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-line bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{localized.ui.country}</p><p className="mt-1 font-bold text-ink-900">Việt Nam</p></div><div className="rounded-2xl border border-line bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{localized.ui.qualified}</p><p className="mt-1 font-bold text-ink-900">{ranked.length}</p></div><div className="rounded-2xl border border-line bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{localized.ui.approach}</p><p className="mt-1 font-bold text-ink-900">Khuyến nghị theo quốc gia</p></div></section>

    <section id="comparison" className="mt-10"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{localized.ui.recommendations}</p><h2 className="mt-1 font-display text-2xl font-bold text-ink-950">{localized.ui.best} tại Việt Nam</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">Các broker dưới đây được lấy từ nhóm đề xuất dành cho Việt Nam và được lọc theo nhu cầu của trang này. Hãy xác nhận điều kiện hiện hành trước khi mở tài khoản.</p>
      {ranked.length ? <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">{ranked.slice(0,8).map((broker,i)=><Reveal key={broker.slug} delay={Math.min(i,5)*0.05}><BrokerCard broker={broker} rank={i+1} countrySlug="vietnam" note={topic ? topicNote(topic, broker) : 'Được xếp hạng trong nhóm broker được PipRank đề xuất cho Việt Nam.'} /></Reveal>)}</div> : <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">PipRank hiện chưa có đủ dữ liệu broker dành riêng cho Việt Nam để đưa ra khuyến nghị đáng tin cậy. Chúng tôi không thay thế bằng danh sách broker toàn cầu.</div>}
    </section>

    <section className="mt-10 rounded-2xl border border-line bg-white p-6"><h2 className="font-display text-xl font-bold text-ink-950">PipRank đánh giá như thế nào?</h2><ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600"><li className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600" /> Bắt đầu từ nhóm broker được đề xuất cho Việt Nam.</li><li className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600" /> Lọc theo đúng nhu cầu giao dịch của trang.</li><li className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600" /> Xem xét chi phí, nền tảng, tài khoản và tín hiệu về độ tin cậy khi có dữ liệu.</li><li className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600" /> Kiểm tra pháp nhân và điều kiện áp dụng cho cư dân Việt Nam trước khi nạp tiền.</li></ul></section>

    <section className="mt-10 space-y-4">{faqs.map(([q,a])=><details key={q} className="rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer font-bold text-ink-900">{q}</summary><p className="mt-3 text-sm leading-7 text-slate-600">{a}</p></details>)}</section>

    <section className="mt-10 rounded-2xl border border-line bg-white p-6"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Ngôn ngữ</p><div className="mt-3 flex flex-wrap gap-3"><Link to={englishPath} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink-900 hover:border-emerald-300 hover:bg-emerald-50">🇬🇧 {englishLabel}</Link><span className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">🇻🇳 Tiếng Việt</span></div></section>

    <section className="mt-10 rounded-3xl bg-ink-950 p-7 text-white sm:p-9"><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Nghiên cứu thêm</p><h2 className="mt-2 font-display text-2xl font-bold">Tìm broker forex phù hợp với bạn</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Sử dụng công cụ tìm broker của PipRank để nhận đề xuất dựa trên nhu cầu giao dịch của bạn.</p><div className="mt-5 flex flex-wrap gap-3"><Link to="/quiz" className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-ink-950">{localized.ui.find}</Link><Link to="/vietnam" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold">{localized.ui.allBrokers}</Link></div></section>
  </div>;
}
