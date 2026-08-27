import {
  countrySeoTopics,
  getCountrySeoTopic,
  brokerMatchesTopic,
  rankCountryTopicBrokers,
  topicMeta,
  topicIntro,
  topicFaq,
  topicNote,
  COUNTRY_SEO_MATRIX_VERSION,
} from './countrySeoMatrix.js';

export type CountrySeoTopic = (typeof countrySeoTopics)[number];
export type CountrySeoTopicKind = CountrySeoTopic['key'];

export {
  countrySeoTopics,
  getCountrySeoTopic,
  brokerMatchesTopic,
  rankCountryTopicBrokers,
  topicMeta,
  topicIntro,
  topicFaq,
  topicNote,
  COUNTRY_SEO_MATRIX_VERSION,
};
