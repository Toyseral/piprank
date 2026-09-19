-- Remove the final short-form intent alias left after canonical ownership migration.
begin;
delete from public.intents where slug='gold';
alter table public.intents drop constraint if exists intents_slug_not_legacy_alias;
alter table public.intents add constraint intents_slug_not_legacy_alias
  check (slug not in ('beginners','low-spread','mt4','mt5','gold','ecn','copy-trading','scalping','swing-trading','high-leverage','islamic'));
commit;
