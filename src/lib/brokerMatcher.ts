import {
  BadgePercent, BookOpen, CalendarRange, Copy, Crown, Gauge, GraduationCap,
  Landmark, MonitorSmartphone, Moon, Server, TrendingUp, Zap, type LucideIcon,
} from 'lucide-react';
import type { Broker } from './types';
import { hasPlatform } from './types';
import { allInCost } from './score';
import { fmtMoney } from './format';

export type BrokerMatchAnswers = {
  country: string;
  experience: string;
  style: string;
  platform: string;
  priority: string;
  prefs: string[];
};

export interface BrokerMatchOption {
  value: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  flag?: string;
}

export interface BrokerMatchQuestion {
  key: keyof BrokerMatchAnswers;
  label: string;
  title: string;
  subtitle: string;
  why: string;
  options: BrokerMatchOption[];
  multi?: boolean;
}

export const BROKER_MATCH_QUESTIONS: BrokerMatchQuestion[] = [
  { key:'country', label:'Country', title:'Where are you trading from?', subtitle:'Tap your country — we only match brokers that can legally onboard you.', why:'One broker can be brilliant in London and unavailable in Lagos. Regulation, leverage and funding rails all change at the border — so this answer rules brokers in or out entirely.', options:[] },
  { key:'experience', label:'Experience', title:'How experienced are you?', subtitle:'Be honest — it changes what "safe" and "easy" mean for you.', why:'Beginners get bonus weighting on education, demos and negative-balance protection. Advanced traders get credit toward ECN execution and pro tooling instead.', options:[
    {value:'beginner',label:"I'm just starting",hint:'New to forex or still on demo',icon:GraduationCap},
    {value:'intermediate',label:'I trade a little',hint:'Live account, small size, still learning',icon:TrendingUp},
    {value:'advanced',label:'I trade seriously',hint:'Consistent live trading, real volume',icon:Crown},
  ]},
  { key:'style', label:'Style', title:'How do you like to trade?', subtitle:'Your holding period decides what actually costs you money.', why:'A scalper is especially sensitive to spread and execution; a swing trader is more exposed to overnight costs.', options:[
    {value:'scalping',label:'Scalping',hint:'Seconds to minutes, dozens of trades a day',icon:Zap},
    {value:'day',label:'Day trading',hint:'Minutes to hours, flat by the close',icon:TrendingUp},
    {value:'swing',label:'Swing trading',hint:'Positions held for days or weeks',icon:CalendarRange},
    {value:'copy',label:'Copy trading',hint:'Mirror proven traders automatically',icon:Copy},
  ]},
  { key:'platform', label:'Platform', title:'Which platform do you want?', subtitle:'EAs, layouts and muscle memory don’t transfer — get this right now.', why:'Platform support can materially affect automation, charting and your workflow.', options:[
    {value:'MT4',label:'MetaTrader 4',hint:'The EA workhorse — old but everywhere',icon:MonitorSmartphone},
    {value:'MT5',label:'MetaTrader 5',hint:'More markets, more timeframes, faster tester',icon:MonitorSmartphone},
    {value:'cTrader',label:'cTrader',hint:'Modern UI with real depth-of-market',icon:Zap},
    {value:'any',label:'No preference',hint:'Whichever platform the match runs',icon:MonitorSmartphone},
  ]},
  { key:'priority', label:'Priority', title:"What's your main priority?", subtitle:'The tiebreaker when two brokers are otherwise equal.', why:'Your top-weighted factor helps break ties between otherwise similar brokers.', options:[
    {value:'lowcost',label:'Lowest costs',hint:'Tight spreads, low commission, no fee creep',icon:BadgePercent},
    {value:'platform',label:'Platform & tools',hint:'Charting, automation, app quality',icon:MonitorSmartphone},
    {value:'education',label:'Education & support',hint:'Courses, hand-holding, fast humans',icon:BookOpen},
    {value:'leverage',label:'High leverage',hint:'Max exposure on a smaller balance',icon:Gauge},
  ]},
  { key:'prefs', label:'Extras', title:'Any optional requirements?', subtitle:'Pick all that apply — or skip. Each one boosts brokers that offer it.', why:'These are preference signals rather than a separate ranking system.', options:[
    {value:'islamic',label:'Islamic account',hint:'Swap-free trading',icon:Moon},
    {value:'copy',label:'Copy trading',hint:'Built-in copy-trading tools',icon:Copy},
    {value:'lowdeposit',label:'Low minimum deposit',hint:'Start under $50',icon:Landmark},
    {value:'highleverage',label:'High leverage',hint:'1:500 or more where offered',icon:Gauge},
    {value:'vps',label:'Free VPS hosting',hint:'Run EAs 24/7 without your laptop',icon:Server},
  ], multi:true},
];

export const BROKER_MATCH_STEP_LABELS = ['Where','Level','Style','Platform','Priority','Extras'];
export const BROKER_MATCH_LOADER_LINES = ['Checking eligibility in your country…','Scoring all brokers against your style…','Ranking your top matches…'];
export const VPS_HOSTS = new Set(['ic-markets','pepperstone','fp-markets','fxpro','exness','thinkmarkets','tmgm','vantage']);

export function scoreBroker(b: Broker, a: BrokerMatchAnswers): { score:number; reasons:string[] } {
  const rating = Number.isFinite(Number(b.rating)) ? Number(b.rating) : 0;
  const trustScore = Number.isFinite(Number(b.trust_score)) ? Number(b.trust_score) : 0;
  const spread = Number.isFinite(Number(b.spread_eurusd)) ? Number(b.spread_eurusd) : Number.POSITIVE_INFINITY;
  const executionMs = Number.isFinite(Number(b.execution_ms)) ? Number(b.execution_ms) : Number.POSITIVE_INFINITY;
  const leverageValue = Number.isFinite(Number(b.leverage_value)) ? Number(b.leverage_value) : 0;
  const minDeposit = Number.isFinite(Number(b.min_deposit)) ? Number(b.min_deposit) : Number.POSITIVE_INFINITY;
  const platforms = Array.isArray(b.platforms) ? b.platforms : [];
  const bestFor = Array.isArray(b.best_for) ? b.best_for : [];
  let s = 44 + rating * 4 + trustScore * 0.14;
  const reasons:string[] = [];
  if (a.style === 'scalping') { if (b.scalping) {s+=12;reasons.push('Scalping fully allowed');} else s-=18; if(spread<=0.2){s+=6;reasons.push(`Raw ${b.spread_eurusd}p EUR/USD spread`);} if(executionMs<=35){s+=4;reasons.push(`${b.execution_ms}ms median execution`);} }
  else if(a.style==='day'){if(spread<=0.3){s+=6;reasons.push(`Tight ${b.spread_eurusd}p spreads all session`);}else s+=1;}
  else if(a.style==='swing'){if(bestFor.includes('swing-trading')){s+=8;reasons.push('Strong multi-day conditions');}}
  else if(a.style==='copy'){if(b.copy_trading){s+=14;reasons.push('Native copy-trading platform');}else s-=12;}
  if(a.platform!=='any'){if(hasPlatform(platforms, a.platform)){s+=9;reasons.push(`${a.platform} supported`);}else s-=8;}
  if(a.priority==='lowcost'){const cost=allInCost(b);s+=Math.max(0,13-cost*6);reasons.push(`${cost} pips all-in per EUR/USD lot`);}
  else if(a.priority==='platform'){s+=platforms.length*3;reasons.push(`${platforms.length} platforms incl. ${platforms[0]?.name ?? 'platform'}`);}
  else if(a.priority==='education'){if(bestFor.includes('beginners')){s+=10;reasons.push('Dedicated beginner education');}if(b.demo_account){s+=3;reasons.push('Free unlimited demo account');}}
  else if(a.priority==='leverage'){s+=leverageValue>=1000?12:leverageValue>=500?10:leverageValue>=400?6:2;reasons.push(`Leverage up to ${b.max_leverage}`);}
  const prefs=a.prefs??[];
  if(prefs.includes('islamic')){if(b.islamic_account){s+=10;reasons.push('Certified swap-free account');}else s-=8;}
  if(prefs.includes('copy')&&a.style!=='copy'){if(b.copy_trading){s+=10;reasons.push('Built-in copy trading');}else s-=6;}
  if(prefs.includes('lowdeposit')){if(minDeposit<=50){s+=8;reasons.push(`Start with ${fmtMoney(Math.max(b.min_deposit,1))||'$0'}`);}else if(minDeposit>250)s-=6;}
  if(prefs.includes('highleverage')&&a.priority!=='leverage'){if(leverageValue>=500){s+=8;reasons.push(`Leverage up to ${b.max_leverage}`);}}
  if(prefs.includes('vps')&&VPS_HOSTS.has(b.slug)){s+=8;reasons.push('Free VPS for 24/7 EAs');}
  if(a.experience==='beginner'){if(bestFor.includes('beginners')){s+=7;reasons.unshift('Beginner-friendly onboarding');}if(b.demo_account)s+=2;}
  else if(a.experience==='advanced'&&bestFor.includes('ecn')){s+=6;reasons.push('True ECN execution model');}
  return {score:s,reasons};
}
