export const CANONICAL_EDITOR_MANIFEST = {
  broker: { contentType:'broker', key:(slug:string)=>`broker:${slug}:main`, route:(slug:string)=>`/brokers/${slug}` },
  globalBestFor: { contentType:'best-for', key:(slug:string)=>`best-for:${slug}`, route:(slug:string)=>`/${slug}` },
  countryBestFor: { contentType:'country-topic', key:(country:string,slug:string)=>`country-topic:${country}:${slug}`, route:(country:string,slug:string)=>`/${country}/${slug}` },
  guide: { contentType:'guide', key:(slug:string)=>`guide:${slug}`, route:(slug:string)=>`/guides/${slug}` },
  countryGuide: { contentType:'country-guide', key:(country:string,slug:string)=>`country-guide:${country}:${slug}`, route:(country:string,slug:string)=>`/${country}/guides/${slug}` },
} as const;
