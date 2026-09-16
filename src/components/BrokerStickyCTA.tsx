import { useEffect, useState } from 'react';
import type { Broker } from '../lib/types';
import { fetchBroker } from '../lib/api';
import { useSEO } from '../hooks/useSEO';
import { brokerSeo, buildBreadcrumbJsonLd, buildWebPageJsonLd, buildFAQPageJsonLd } from '../lib/seo';
import VisitButton from './VisitButton';
import Monogram from './Monogram';

interface Props {
  slug: string;
}

export default function BrokerStickyCTA({ slug }: Props) {
  const [broker, setBroker] = useState<Broker | null>(null);

  useEffect(() => {
    let live = true;
    fetchBroker(slug).then((value) => {
      if (live) setBroker(value);
    }).catch(() => {
      if (live) setBroker(null);
    });
    return () => { live = false; };
  }, [slug]);

  const seo = broker ? brokerSeo(broker) : null;
  useSEO(
    seo,
    broker
      ? [
          buildWebPageJsonLd(seo!),
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Forex Brokers', path: '/brokers' },
            { name: broker.name, path: `/brokers/${broker.slug}` },
          ]),
          ...(broker.faqs?.length
            ? [buildFAQPageJsonLd(broker.faqs.map((faq) => ({ question: faq.q, answer: faq.a })))]
            : []),
        ]
      : null,
  );

  if (!broker) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-3 py-2.5 shadow-[0_-8px_30px_rgba(15,23,42,0.10)] backdrop-blur-md sm:px-6 sm:py-3">
      <div className="mx-auto flex max-w-7xl items-center gap-3 sm:gap-4">
        <Monogram
          name={broker.name}
          logoUrl={broker.logo_url}
          color={broker.brand_color}
          size={40}
          className="hidden shrink-0 rounded-xl ring-1 ring-line sm:flex"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink-950 sm:text-base">Open {broker.name} Account</p>
          <p className="hidden text-xs text-slate-500 sm:block">Review the broker details above before opening an account.</p>
        </div>
        <VisitButton broker={broker} compact className="shrink-0" />
      </div>
    </div>
  );
}
