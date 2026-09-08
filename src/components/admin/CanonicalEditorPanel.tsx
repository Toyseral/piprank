import CanonicalEditorIndex from './CanonicalEditorIndex';
import CanonicalBrokerWorkspace from './CanonicalBrokerWorkspace';
import CanonicalGuideWorkspace from './CanonicalGuideWorkspace';
import type { Broker, ContentDocument, CountryPage, Guide, Intent } from '../../lib/types';

export default function CanonicalEditorPanel({ mode, guides, intents, docs, brokers, countries, token, countrySlug, onSaved }: { mode:'global-best-for'|'country-best-for'|'global-guides'|'country-guides'|'brokers'; guides:Guide[]; intents:Intent[]; docs:ContentDocument[]; brokers:Broker[]; countries:CountryPage[]; token:string; countrySlug?:string; onSaved:()=>Promise<void>|void }) {
 if(mode==='brokers')return <CanonicalBrokerWorkspace brokers={brokers} token={token} onSaved={onSaved}/>;
 if(mode==='global-guides'||mode==='country-guides')return <CanonicalGuideWorkspace guides={guides} brokers={brokers} countries={countries} docs={docs} token={token} countrySlug={mode==='country-guides'?countrySlug:undefined} onSaved={onSaved}/>;
 return <CanonicalEditorIndex mode={mode==='global-best-for'?'global':'country'} intents={intents} docs={docs} brokers={brokers} countries={countries} token={token} onSaved={onSaved}/>;
}
