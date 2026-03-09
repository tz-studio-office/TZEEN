# Cloudflare R2 setup for reading material images

This project now uploads reading-material images through a Cloudflare Pages Function instead of Supabase Storage.

## What changed

- Frontend upload target: `POST /api/r2-upload`
- Runtime storage: Cloudflare R2 bucket binding `READING_IMAGES_BUCKET`
- Auth check: Supabase session token is validated in the Pages Function
- Allowed upload roles: `coach`, `admin`

## Required Cloudflare bindings

In your Cloudflare Pages project, add these bindings:

### R2 binding
- Binding name: `READING_IMAGES_BUCKET`
- Bucket: your public reading-images bucket

### Environment variables / secrets
- `R2_PUBLIC_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Example public base URL:
- `https://pub-xxxxxxxxxxxxxxxx.r2.dev`
- or your custom domain such as `https://img.example.com`

## Frontend env vars

Use these for local or Pages builds:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_R2_UPLOAD_ENDPOINT` (optional, defaults to `/api/r2-upload`)

## Recommended architecture

- Auth / roles / DB / RLS: Supabase
- Reading-material images: Cloudflare R2
- Frontend hosting: Cloudflare Pages

## Notes

- Existing `image_url` values in `reading_materials` continue to work.
- The old Supabase Storage migration can remain for now, but new uploads no longer depend on it.
- For local development, use `wrangler pages dev` if you want the Pages Function to run locally.
