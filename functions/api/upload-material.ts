interface Env {
  MATERIAL_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  R2_PUBLIC_BASE_URL?: string;
}

interface SupabaseUserResponse {
  id: string;
  app_metadata?: { role?: string };
  user_metadata?: { role?: string };
}

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function getSupabaseUser(token: string, env: Env): Promise<SupabaseUserResponse | null> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!response.ok) return null;
  return response.json<SupabaseUserResponse>();
}

function getRole(user: SupabaseUserResponse) {
  return user.app_metadata?.role || user.user_metadata?.role || 'student';
}

function ext(file: File) {
  return file.name.split('.').pop()?.toLowerCase() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const user = await getSupabaseUser(token, env);
    if (!user) return json({ error: 'Invalid session' }, 401);
    const role = getRole(user);
    if (role !== 'coach' && role !== 'admin') return json({ error: 'Forbidden' }, 403);

    const form = await request.formData();
    const file = form.get('file');
    const materialId = String(form.get('materialId') || '').trim();
    const pageNumber = Number(form.get('pageNumber') || 1);

    if (!(file instanceof File)) return json({ error: 'File is required.' }, 400);
    if (!materialId) return json({ error: 'materialId is required.' }, 400);
    if (!ALLOWED_TYPES.has(file.type)) return json({ error: 'Unsupported file type.' }, 400);

    const key = `materials/${materialId}/page_${String(pageNumber).padStart(3, '0')}.${ext(file)}`;
    await env.MATERIAL_BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

    const baseUrl = env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '') || '';
    return json({ success: true, key, url: baseUrl ? `${baseUrl}/${key}` : key });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Upload failed' }, 500);
  }
};
