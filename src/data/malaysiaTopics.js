// Malaysia country guide topics: explanatory/educational content only
// (how something works, how to evaluate it, what a regulation means).
//
// These pages must NEVER contain a ranked "best brokers for X" list — that
// shape of page belongs to the country-topic matrix (src/data/countrySeoMatrix.js,
// rendered at /malaysia/:topicSlug), which already owns broker ranking and
// eligibility for this market. If a new guide topic here starts wanting a
// ranked broker list, that's the signal to add it to the matrix instead of
// writing it here — not a reason to avoid the underlying subject. A guide
// about MT5 vs MT4, leverage, or minimum deposits is fine; a guide that
// becomes a "best MT5 brokers in Malaysia" list is not, since
// mt5-forex-brokers already exists in the matrix and the two would compete
// for the same query. See PHASE-16-OVERLAP-RESOLUTION for the migration
// that retired the first 3 topics that drifted into this shape.
// NOTE: this file is now only used by
// scripts/migrate-guides-to-content-documents.mjs — the page component that
// used to render this data (MalaysiaTopic.tsx) was retired in favor of the
// generic /:countrySlug/guides/:slug route (GuideTopic.tsx), which reads
// from content_documents instead. Once the migration script has been run
// once against production and the resulting pages verified, this file can
// be deleted.
export const malaysiaTopics = [
  {
    slug: 'is-forex-trading-legal-in-malaysia',
    title: 'Is Forex Trading Legal in Malaysia?',
    description: 'A practical Malaysia-focused guide to forex trading, broker licensing, foreign exchange rules and how to check a broker before depositing.',
    category: 'Regulation',
    sections: [
      { heading: 'The short answer', body: ['Forex trading involves several different activities, so legality should not be reduced to a simple yes-or-no statement. Malaysian residents should distinguish between foreign-exchange transactions, leveraged retail trading products and the regulatory status of the provider they are dealing with.', 'PipRank does not treat a broker as Malaysian-regulated merely because it accepts Malaysian clients. The exact legal entity, licence and regulator matter.'] },
      { heading: 'How to check a broker', body: ['The Securities Commission Malaysia maintains a public register that investors can use to check licensed or registered capital-market intermediaries. It also publishes an Investor Alert List covering unauthorised websites, products, companies and individuals.'], links: [{ label: 'Check the SC Malaysia licensed intermediary register', href: 'https://www.sc.com.my/regulation/enforcement/investor-alerts/list-of-licenced-intermediaries' }] },
      { heading: 'Why the contracting entity matters', body: ['An international broker may serve Malaysian clients through an overseas entity rather than a Malaysian-licensed entity. That can change the regulator, protections, leverage rules, dispute route and account terms that apply to the client.', 'Before opening an account, read the broker agreement and confirm the legal entity named in the terms—not just the brand name shown on the website.'] },
      { heading: 'A safer checklist for Malaysian traders', bullets: ['Identify the legal entity that will hold your account.', 'Check the regulator and licence status of that entity.', 'Check whether the broker currently accepts Malaysian residents.', 'Read withdrawal, margin, leverage and client-money terms before funding.', 'Check the SC Investor Alert List and other official notices when appropriate.'] },
    ],
    faqs: [
      { q: 'Is forex trading legal in Malaysia?', a: 'The answer depends on the product, provider and transaction. Malaysian traders should verify the legal entity and applicable regulatory status rather than assuming that an international broker is locally licensed.' },
      { q: 'Does accepting Malaysian clients mean a broker is regulated in Malaysia?', a: 'No. A broker can accept clients from Malaysia through an overseas entity. PipRank separates country availability from local regulatory status.' },
      { q: 'Where can I check whether an intermediary is licensed in Malaysia?', a: 'The Securities Commission Malaysia provides a public register of licensed or registered intermediaries and publishes an Investor Alert List for unauthorised entities.' },
    ],
  },
  {
    slug: 'forex-trading-in-malaysia',
    title: 'Forex Trading in Malaysia: What Traders Need to Know',
    description: 'Understand how to evaluate forex brokers in Malaysia, including legal entities, regulation, costs, platforms, funding and withdrawals.',
    category: 'Malaysia forex guide',
    sections: [
      { heading: 'Start with the broker, not the leverage', body: ['A high leverage figure can look attractive, but it is not a substitute for a suitable broker. Malaysian traders should start by checking who operates the account, which regulator supervises that entity and which client terms apply.'] },
      { heading: 'Compare the costs that actually affect trading', bullets: ['EUR/USD and other major-pair spreads', 'Commission on raw-spread accounts', 'Swap or overnight financing', 'Deposit and withdrawal charges', 'Currency-conversion costs', 'Minimum deposit and margin requirements'] },
      { heading: 'Platform choice matters', body: ['MT4, MT5 and other platforms can differ in order types, automation, charting and available instruments. Choose the platform based on how you trade rather than choosing a broker solely because it advertises a familiar platform.'] },
      { heading: 'Check funding and withdrawal terms', body: ['Payment options and processing conditions can vary by country and entity. Confirm the methods available to Malaysian clients and read the broker’s current withdrawal rules before depositing.'] },
    ],
    faqs: [
      { q: 'What should Malaysian traders compare first?', a: 'Compare the legal entity, regulatory status, country availability, total trading costs, platform, account type and withdrawal conditions.' },
      { q: 'Is the cheapest spread always the best choice?', a: 'No. The lowest quoted spread can be outweighed by commission, swaps, execution quality, account requirements or other costs.' },
    ],
  },
  {
    slug: 'how-to-choose-a-forex-broker-in-malaysia',
    title: 'How to Choose a Forex Broker in Malaysia',
    description: 'A step-by-step checklist for comparing forex brokers available to Malaysian traders, from regulation and costs to platforms and withdrawals.',
    category: 'Broker selection',
    sections: [
      { heading: '1. Confirm who you are contracting with', body: ['The broker brand is only the starting point. Find the legal entity named in the account agreement and confirm its regulator, licence and applicable client protections.'] },
      { heading: '2. Confirm Malaysia availability', body: ['Country availability can change and can differ by entity. A broker page should not be treated as proof that a particular account can currently be opened from Malaysia. Confirm eligibility during onboarding.'] },
      { heading: '3. Compare total trading costs', body: ['Look beyond the headline spread. Compare spreads, commissions, swaps, conversion charges and any account-specific fees for the instruments you actually trade.'] },
      { heading: '4. Match the broker to your trading style', bullets: ['Beginners: simple account structure, education and transparent costs.', 'Scalpers: tight effective spreads, commission structure and execution conditions.', 'MT5 users: platform availability and instrument coverage.', 'Gold traders: XAU/USD costs, contract specifications and trading hours.', 'Swap-sensitive traders: check whether swap-free terms are available and what restrictions apply.'] },
      { heading: '5. Test the operational details', body: ['Before committing significant funds, understand deposits, withdrawals, verification, margin calls and account closure procedures.'] },
    ],
    faqs: [
      { q: 'What is the most important factor when choosing a forex broker?', a: 'Start with the legal entity and regulatory status, then compare country availability, total costs, trading conditions, platform and withdrawal terms.' },
      { q: 'Should Malaysian beginners choose the broker with the highest leverage?', a: 'No. Leverage increases exposure and should not be the primary selection criterion.' },
    ],
  },
  {
    slug: 'forex-broker-regulation-in-malaysia',
    title: 'Forex Broker Regulation in Malaysia Explained',
    description: 'Learn how Malaysian traders should evaluate forex broker regulation, licences, legal entities and investor alerts before opening an account.',
    category: 'Regulation',
    sections: [
      { heading: 'Regulation is entity-specific', body: ['A broker brand can operate through more than one company. The regulator attached to your account depends on the entity you contract with. This is why PipRank displays availability separately from regulation.'] },
      { heading: 'Use official registers', body: ['The Securities Commission Malaysia provides a public register for checking licensed or registered intermediaries. The SC also maintains an Investor Alert List for unauthorised websites, investment products, companies and individuals.'], links: [{ label: 'SC Malaysia: Licensed Intermediary and Representative Search', href: 'https://www.sc.com.my/regulation/enforcement/investor-alerts/list-of-licenced-intermediaries' }, { label: 'SC Malaysia: Investor Alert updates', href: 'https://www.sc.com.my/resources/media/investor-alert-updates' }] },
      { heading: 'Do not confuse foreign regulation with Malaysian licensing', body: ['An overseas regulator may supervise the entity serving a Malaysian client, but that does not make the broker locally licensed by the Malaysian regulator. The distinction affects the protections and dispute mechanisms available to the client.'] },
      { heading: 'What to record before opening an account', bullets: ['Legal entity name', 'Regulator and licence number where applicable', 'Jurisdiction of the account', 'Client-money and protection terms', 'Dispute and complaint route', 'Current onboarding eligibility for Malaysia'] },
    ],
    faqs: [
      { q: 'How do I check a forex broker in Malaysia?', a: 'Identify the legal entity first, then check the relevant official regulator register and the Securities Commission Malaysia’s Investor Alert List where applicable.' },
      { q: 'Is an overseas-regulated broker the same as a Malaysian-regulated broker?', a: 'No. The regulator and jurisdiction of the entity serving the client are distinct from the broker’s brand and from Malaysian local licensing.' },
    ],
  },
  {
    slug: 'forex-spreads-explained-for-malaysian-traders',
    title: 'Forex Spreads Explained for Malaysian Traders',
    description: 'Learn how forex spreads work, how to compare broker pricing in Malaysia and why spread alone is not the full cost of trading.',
    category: 'Trading costs',
    sections: [
      { heading: 'What is a forex spread?', body: ['The spread is the difference between the bid and ask price. It is one of the main trading costs and can vary by instrument, market conditions, account type and time of day.'] },
      { heading: 'Quoted spread vs effective cost', body: ['A broker can advertise a low spread while charging commission on the account. To compare brokers fairly, consider the spread and commission together and check the conditions under which the quoted spread is available.'] },
      { heading: 'Why spreads change', bullets: ['Market volatility', 'News and economic releases', 'Liquidity and trading hours', 'Instrument and account type', 'Broker execution conditions'] },
      { heading: 'What Malaysian traders should compare', body: ['For the pairs and instruments you actually trade, compare typical or observed pricing where reliable data exists, commission, swap and any currency-conversion costs. Do not assume that the lowest EUR/USD headline spread makes a broker cheapest for every strategy.'] },
    ],
    faqs: [
      { q: 'What is a good forex spread?', a: 'It depends on the instrument, account type and commission. A narrow spread with a separate commission can have a similar or higher all-in cost than a wider spread with no commission.' },
      { q: 'Are forex spreads fixed?', a: 'Not always. Many retail forex accounts use variable spreads that can widen during volatile or less liquid market conditions.' },
    ],
  },
];
