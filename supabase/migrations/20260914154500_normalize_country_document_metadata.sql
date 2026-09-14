-- Country guide and country Best-For documents do not use the retired
-- generic topic field. Their ownership is expressed by content_type + slug.
update public.content_documents
set topic_slug = null,
    updated_at = now()
where content_type in ('country-guide', 'country-best-for')
  and topic_slug is not null;
