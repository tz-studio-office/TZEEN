interface Env {
  READING_IMAGES_BUCKET?: R2Bucket;
  MATERIAL_BUCKET?: R2Bucket;
  R2_PUBLIC_BASE_URL?: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

interface SupabaseUserResponse {
  id: string;
  email?: string;
  app_metadata?: {
    role?: string;
  };
  user_metadata?: {
    role?: string;
  };
}

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function sanitizeSegment(input: string) {
  return input.replace(/[^a-zA-Z0-9/_-]/g, '-').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
}

function getExtension(fileName: string, contentType: string) {
  const explicit = fileName.split('.').pop()?.toLowerCase();
  if (explicit && explicit.length <= 5) return explicit;

  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/heic':
    case 'image/heif':
      return 'heic';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

function getRole(user: SupabaseUserResponse) {
  return user.app_metadata?.role || user.user_metadata?.role || 'student';
}

async function getSupabaseUser(token: string, env: Env): Promise<SupabaseUserResponse | null> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) return null;
  return response.json<SupabaseUserResponse>();
}

function getBucket(env: Env) {
  return env.MATERIAL_BUCKET || env.READING_IMAGES_BUCKET;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const user = await getSupabaseUser(token, env);
    if (!user) {
      return json({ error: 'Invalid session' }, 401);
    }

    const role = getRole(user);
    if (role !== 'coach' && role !== 'admin') {
      return json({ error: 'Only coaches and admins can upload files.' }, 403);
    }

    const bucket = getBucket(env);
    if (!bucket) {
      return json({ error: 'R2 bucket binding is missing.' }, 500);
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return json({ error: 'File is required.' }, 400);
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return json({ error: 'Unsupported file type.' }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return json({ error: 'File must be 15MB or smaller.' }, 400);
    }

    const extension = getExtension(file.name, file.type);
    const folder = sanitizeSegment(String(formData.get('folder') || `materials/${user.id}`));
    const requestedFilename = sanitizeSegment(String(formData.get('filename') || ''));
    const finalName = requestedFilename
      ? requestedFilename.endsWith(`.${extension}`)
        ? requestedFilename
        : `${requestedFilename}.${extension}`
      : `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const key = `${folder}/${finalName}`;

    await bucket.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        uploadedBy: user.id,
        role,
      },
    });

    const baseUrl = env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '') || '';
    return json({
      key,
      url: baseUrl ? `${baseUrl}/${key}` : key,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return json({ error: message }, 500);
  }
};
