delete from public.content_documents
where content_type='country-topic'
  and (
    content_key in ('country-topic:ghana:is-this-rear','country-topic:nigeria:cdf-brokerw','country-topic:vietnam:cdf-brokers')
    or slug in ('is-this-rear','cdf-brokerw','cdf-brokers')
  );
