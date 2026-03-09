# Materials / OCR / Vocabulary Test implementation

This update adds the database and UI foundation for:

- R2-backed textbook uploads (`jpeg`, `jpg`, `png`, `webp`, `heic`, `pdf`)
- OCR job metadata and coach verification tables
- assignment-level passing score / range / direction rules
- student-created custom vocabulary tests
- per-attempt score tracking and answer history

## What is included

### Database
Migration:
- `supabase/migrations/20260307213000_add_materials_vocab_workflow.sql`

New tables:
- `materials`
- `material_files`
- `ocr_runs`
- `vocabulary_entries`
- `grammar_entries`
- `assignment_test_rules`
- `student_custom_tests`
- `test_attempts`
- `test_attempt_answers`
- `assignment_progress`

Also extends `assignments` with:
- `assignment_type`
- `material_id`
- `range_start`
- `range_end`
- `required_score`
- `notes`

### Frontend
- New coach page: `src/pages/coach/Materials.tsx`
- New route: `/materials`
- Student vocab page rewritten to use DB-backed materials / attempts

### Upload endpoint
`functions/api/r2-upload.ts` now accepts:
- images and pdfs
- optional `folder`
- optional `filename`

## Important note
OCR extraction itself is **not** wired to an external OCR provider in this update.
This build registers OCR jobs in `ocr_runs` with status `queued` so you can later connect:

- Cloudflare Workers AI / Vision
- OpenAI vision extraction
- another OCR worker pipeline

## Recommended next step
1. Apply the new migration in Supabase
2. Deploy the updated Pages Functions / frontend
3. Upload textbook pages from `/materials`
4. Connect an OCR worker that reads `ocr_runs(status='queued')`
5. Save extracted rows into `vocabulary_entries`
6. Coach reviews / verifies extracted entries
7. Students build tests or take assigned tests
