interface Env {
  MATERIAL_BUCKET: R2Bucket;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  if (!key) return new Response('Missing key', { status: 400 });

  const object = await env.MATERIAL_BUCKET.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const ext = key.split('.').pop()?.toLowerCase() || '';
  const contentType = object.httpMetadata?.contentType || MIME_BY_EXT[ext] || 'application/octet-stream';

  return new Response(object.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
