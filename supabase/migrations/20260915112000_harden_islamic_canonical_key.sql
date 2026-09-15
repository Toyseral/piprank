UPDATE public.content_documents
SET content_type = 'global-best-for',
    content_key = 'best-for:islamic-forex-brokers',
    country_slug = NULL,
    topic_slug = 'islamic',
    slug = 'islamic-forex-brokers'
WHERE id = 211
   OR content_key = 'best-for:islamic'
   OR slug = 'islamic-forex-brokers';
