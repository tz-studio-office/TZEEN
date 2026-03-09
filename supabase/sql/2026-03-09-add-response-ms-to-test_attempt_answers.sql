alter table if exists public.test_attempt_answers
add column if not exists response_ms integer;
