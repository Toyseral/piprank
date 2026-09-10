import fs from 'node:fs';

const adminPath = 'src/pages/Admin.tsx';
const countryHubPath = 'src/pages/admin/countries/CountryHub.tsx';

const text = fs.readFileSync(adminPath, 'utf8');
const startMarker = 'function CountryHub(';
const endMarker = 'function CountryLanguagesPanel(';
const start = text.indexOf(startMarker);
const end = text.indexOf(endMarker, start);

if (start < 0) throw new Error('Could not find CountryHub in Admin.tsx.');
if (end < 0) throw new Error('Could not find CountryLanguagesPanel boundary in Admin.tsx.');

const extracted = text.slice(start, end).trim();
if (!extracted.startsWith(startMarker)) throw new Error('Extracted CountryHub does not start correctly.');

const countryHub = extracted
  .replace(
    /function CountryHub\(\{ countries, brokers, countryBestFors, contentDocs, countryLanguages, localizedPages, token, notify, reloadLocalization, onNewCountry, onEditCountry, onEditCountryBestFor, onNewCountryBestFor, onEditContentDoc, onNewCountryContentDoc \}: \{[\s\S]*?\}\) \{/,
    `function CountryHub({ countries, brokers, countryBestFors, contentDocs, token, notify, onNewCountry, onEditCountry, onEditCountryBestFor, onNewCountryBestFor, renderLanguagesPanel }: { countries: CountryPage[]; brokers: Broker[]; countryBestFors: CountryBestFor[]; contentDocs: ContentDocument[]; token: string; notify: (msg: string) => void; onNewCountry: () => void; onEditCountry: (country: CountryPage) => void; onEditCountryBestFor: (page: CountryBestFor) => void; onNewCountryBestFor: (countrySlug: string) => void; renderLanguagesPanel: (country: CountryPage) => ReactNode }) {`
  )
  .replace(
    /<CountryLanguagesPanel country=\{selected\} countryLanguages=\{countryLanguages\} localizedPages=\{localizedPages\} token=\{token\} notify=\{notify\} reload=\{reloadLocalization\} onEditContentDoc=\{onEditContentDoc\}\/>/,
    '{renderLanguagesPanel(selected)}'
  );

if (countryHub === extracted) throw new Error('CountryHub signature was not transformed.');
if (!countryHub.includes('{renderLanguagesPanel(selected)}')) throw new Error('CountryHub language panel boundary was not transformed.');

const helpers = `

function HubMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-ink-900">{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>
    </div>
  );
}

function EntityPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-xs font-medium text-slate-600">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

const SUPERSEDED_INTENT_TO_TOPIC: Record<string, string> = {
  'best-forex-brokers-for-beginners': 'forex-brokers-for-beginners',
  'best-low-spread-forex-brokers': 'low-spread-forex-brokers',
  'best-mt4-forex-brokers': 'mt4-forex-brokers',
  'best-mt5-forex-brokers': 'mt5-forex-brokers',
  'best-gold-brokers': 'gold-forex-brokers',
  'best-forex-brokers-for-scalping': 'forex-brokers-for-scalping',
  'best-islamic-forex-brokers': 'islamic-forex-brokers',
  'best-ecn-forex-brokers': 'ecn-forex-brokers',
  'best-copy-trading-forex-brokers': 'copy-trading-forex-brokers',
  'best-forex-brokers-for-swing-trading': 'forex-brokers-for-swing-trading',
  'best-high-leverage-forex-brokers': 'high-leverage-forex-brokers',
};
`;

const file = `import { useEffect, useState, type ReactNode } from 'react';
import { Eye, Pencil, Plus, Search } from 'lucide-react';
import type { Broker, ContentDocument, CountryBestFor, CountryPage } from '../../../lib/types';
import CountryGuides from '../../../components/admin/CountryGuides';
${helpers}
${countryHub}
`;

fs.mkdirSync('src/pages/admin/countries', { recursive: true });
fs.writeFileSync(countryHubPath, file);

let next = text;
const importLine = "import CountryHub from './admin/countries/CountryHub';";
const importAnchor = "import CountryGuides from './admin/CountryGuides';";
if (!next.includes(importLine)) {
  if (!next.includes(importAnchor)) throw new Error('Could not find CountryGuides import anchor in Admin.tsx.');
  next = next.replace(importAnchor, `${importAnchor}\n${importLine}`);
}

next = next.slice(0, start) + next.slice(end);

const invocationPattern = /\s*<CountryHub\n[\s\S]*?\n\s*\/>/;
const invocationMatch = next.match(invocationPattern);
if (!invocationMatch) throw new Error('Could not find CountryHub JSX invocation in Admin.tsx.');

const replacement = `
                  <CountryHub
                    countries={countries}
                    brokers={brokers}
                    countryBestFors={countryBestFors}
                    contentDocs={contentDocs}
                    token={session.access_token}
                    notify={notify}
                    onNewCountry={() => setEditingCountry('new')}
                    onEditCountry={(c) => setEditingCountry(c)}
                    onEditCountryBestFor={(p) => setEditingCountryBestFor(p)}
                    onNewCountryBestFor={() => setEditingCountryBestFor('new')}
                    renderLanguagesPanel={(country) => (
                      <CountryLanguagesPanel
                        country={country}
                        countryLanguages={countryLanguages}
                        localizedPages={localizedPages}
                        token={session.access_token}
                        notify={notify}
                        reload={reloadLocalization}
                        onEditContentDoc={(d) => setEditingContentDoc(d)}
                      />
                    )}
                  />`;

next = next.replace(invocationPattern, replacement);

fs.writeFileSync(adminPath, next);
console.log('Extracted CountryHub to src/pages/admin/countries/CountryHub.tsx');
console.log('CountryLanguagesPanel remains in Admin.tsx and is injected through renderLanguagesPanel.');
console.log('Run: npx tsc -b');
