// PipRank editorial team.
//
// Names are pen names (consistent editorial identities), used the way many
// finance and trade publications attribute recurring bylines. What's true
// here is the role each identity covers and the process behind it — we do
// not fabricate specific external credentials (degrees, certifications,
// named past employers) that we can't stand behind, since false claims of
// that kind are the opposite of what a trust page is for.

export interface TeamMember {
  slug: string;
  penName: string;
  role: string;
  color: string;
  focus: string;
  bio: string;
}

export const TEAM: TeamMember[] = [
  {
    slug: 'r-adeyemi',
    penName: 'R. Adeyemi',
    role: 'Lead Broker Reviewer',
    color: '#1f8a5c',
    focus: 'Regulation & entity verification',
    bio: 'Leads broker onboarding at PipRank: verifying licence status against regulator registers, identifying the specific legal entity behind each account, and writing the regulation sections of our reviews.',
  },
  {
    slug: 'j-okafor',
    penName: 'J. Okafor',
    role: 'Trading Costs & Execution Editor',
    color: '#38bdf8',
    focus: 'Spreads, execution and withdrawal testing',
    bio: 'Runs the real-money testing process behind every spread, execution-speed and withdrawal-timing figure published on PipRank, and maintains the trading-cost sections of broker reviews.',
  },
  {
    slug: 'l-mensah',
    penName: 'L. Mensah',
    role: 'Data & Methodology Lead',
    color: '#a78bfa',
    focus: 'Health Score formula & data pipeline',
    bio: 'Maintains the Health Score methodology and the data pipeline behind it — refresh cadence, factor weighting, and keeping scores consistent as broker conditions change.',
  },
  {
    slug: 's-nwachukwu',
    penName: 'S. Nwachukwu',
    role: 'Country & Compliance Editor',
    color: '#f5b53f',
    focus: 'Country-specific availability & regulatory context',
    bio: 'Covers country-level broker availability, local regulatory context, and the country-specific guides published on PipRank.',
  },
];

export function getTeamMember(slug: string): TeamMember | undefined {
  return TEAM.find((t) => t.slug === slug);
}

// Deterministic, non-random assignment so the same broker always shows the
// same reviewer across builds rather than shuffling on every deploy.
export function reviewerFor(brokerSlug: string): TeamMember {
  let hash = 0;
  for (let i = 0; i < brokerSlug.length; i++) hash = (hash * 31 + brokerSlug.charCodeAt(i)) >>> 0;
  return TEAM[hash % TEAM.length];
}
