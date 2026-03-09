
alter table public.vocabulary_entries
  add column if not exists example_sentence text;
