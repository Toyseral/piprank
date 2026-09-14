import {
  countrySeoTopics,
  getCountrySeoTopic,
  brokerMatchesTopic,
  rankCountryTopicBrokers as rankCountryTopicBrokersRaw,
  topicMeta,
  topicIntro as topicIntroRaw,
  topicFaq,
  topicNote,
  COUNTRY_SEO_MATRIX_VERSION,
} from './countrySeoMatrix.js';
import type { Broker, CountryPage } from '../lib/types';

export type CountrySeoTopic = (typeof countrySeoTopics)[number];
export type CountrySeoTopicKind = CountrySeoTopic['key'];

export function rankCountryTopicBrokers(
  brokers: Broker[],
  country: CountryPage,
  topic: CountrySeoTopic,
): Broker[] {
  return rankCountryTopicBrokersRaw(brokers, country, topic) as Broker[];
}

export function topicIntro(topic: CountrySeoTopic, country: string): string[] {
  return topicIntroRaw(topic, country) as string[];
}

export {
  countrySeoTopics,
  getCountrySeoTopic,
  brokerMatchesTopic,
  topicMeta,
  topicFaq,
  topicNote,
  COUNTRY_SEO_MATRIX_VERSION,
};
