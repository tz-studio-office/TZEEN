interface Env {
  MATERIAL_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function supabaseHeaders(env: Env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const fileId = String(body.fileId || '').trim();
    const r2Key = String(body.r2Key || '').trim();

    if (!fileId || !r2Key) return json({ error: 'fileId and r2Key are required.' }, 400);

    await env.MATERIAL_BUCKET.delete(r2Key);

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/material_files?id=eq.${fileId}`, {
      method: 'DELETE',
      headers: supabaseHeaders(env),
    });

    if (!res.ok) return json({ error: await res.text() }, 500);
    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Delete failed' }, 500);
  }
};
