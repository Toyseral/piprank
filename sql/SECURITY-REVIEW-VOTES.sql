-- Atomic helpful-vote increment used by /api/reviews.
-- Run this migration in Supabase before relying on the RPC path.
create or replace function public.increment_review_helpful(review_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  update public.reviews
     set helpful = coalesce(helpful, 0) + 1
   where id = review_id
  returning to_jsonb(reviews.*) into result;

  if result is null then
    raise exception 'review not found';
  end if;

  return result;
end;
$$;

revoke all on function public.increment_review_helpful(bigint) from public;
