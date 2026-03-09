create table if not exists public.vocab_practice_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  vocabulary_entry_id uuid not null references public.vocabulary_entries(id) on delete cascade,
  result text not null check (result in ('ok', 'ng')),
  response_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_vocab_practice_logs_student_material
  on public.vocab_practice_logs (student_id, material_id, created_at desc);

create index if not exists idx_vocab_practice_logs_entry
  on public.vocab_practice_logs (vocabulary_entry_id, created_at desc);
