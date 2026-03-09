type Env = {
  OPENAI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  R2_PUBLIC_BASE_URL?: string;
};

type OcrEntry = {
  entry_no?: number | null;
  english?: string | null;
  japanese?: string | null;
  example_sentence?: string | null;
  part_of_speech?: string | null;
  title?: string | null;
  explanation?: string | null;
  example_sentence?: string | null;
  japanese_explanation?: string | null;
};

type MaterialFileRow = {
  id: string;
  material_id: string;
  r2_key?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  page_number?: number | null;
  materials?: {
    id: string;
    title: string;
    material_type?: string | null;
  } | null;
};

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
  });
}

function buildPublicFileUrl(baseUrl: string, r2Key: string) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  const encodedKey = r2Key
    .split('/')
    .map((p) => encodeURIComponent(p))
    .join('/');
  return `${trimmed}/${encodedKey}`;
}

function resolvePublicFileUrl(file: MaterialFileRow, env: Env) {
  if (file.file_url && /^https?:\/\//i.test(file.file_url)) {
    return file.file_url;
  }

  const baseUrl = (env.R2_PUBLIC_BASE_URL || '').trim();
  if (!baseUrl) {
    throw new Error('R2_PUBLIC_BASE_URL is not set. Add the R2 public base URL in Cloudflare Pages Variables and Secrets.');
  }
  if (!file.r2_key) {
    throw new Error('This material file is missing r2_key, so a public OCR URL could not be built.');
  }

  return buildPublicFileUrl(baseUrl, file.r2_key);
}

function toCleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const m = value.match(/\d+/);
    if (m) return Number(m[0]);
  }
  return null;
}

function dedupeByKey<T>(rows: T[], getKey: (row: T) => string) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = getKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeVocabularyEntries(entries: unknown): OcrEntry[] {
  if (!Array.isArray(entries)) return [];
  const mapped = entries
    .map((row) => {
      const item = row as Record<string, unknown>;
      const english =
        toCleanString(item.english) ??
        toCleanString(item.word) ??
        toCleanString(item.english_word) ??
        toCleanString(item.term);
      const japanese =
        toCleanString(item.japanese) ??
        toCleanString(item.meaning) ??
        toCleanString(item.translation) ??
        toCleanString(item.ja);
      const partOfSpeech =
        toCleanString(item.part_of_speech) ??
        toCleanString(item.pos) ??
        toCleanString(item.word_class);
      const exampleSentence =
        toCleanString(item.example_sentence) ??
        toCleanString(item.example) ??
        toCleanString(item.sentence);
      return {
        entry_no: toNumber(item.entry_no) ?? toNumber(item.word_number) ?? toNumber(item.no),
        english,
        japanese,
        example_sentence: exampleSentence,
        part_of_speech: partOfSpeech,
      };
    })
    .filter((x) => x.english || x.japanese || x.example_sentence || x.part_of_speech);

  return dedupeByKey(mapped, (x) => `${x.entry_no ?? ''}|${x.english ?? ''}|${x.japanese ?? ''}`);
}

function normalizeGrammarEntries(entries: unknown): OcrEntry[] {
  if (!Array.isArray(entries)) return [];
  const mapped = entries
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        entry_no: toNumber(item.entry_no) ?? toNumber(item.no),
        title: toCleanString(item.title) ?? toCleanString(item.grammar_point),
        explanation: toCleanString(item.explanation) ?? toCleanString(item.description),
        example_sentence: toCleanString(item.example_sentence) ?? toCleanString(item.example),
        japanese_explanation: toCleanString(item.japanese_explanation) ?? toCleanString(item.japanese),
      };
    })
    .filter((x) => x.title || x.explanation || x.example_sentence || x.japanese_explanation);

  return dedupeByKey(mapped, (x) => `${x.entry_no ?? ''}|${x.title ?? ''}|${x.example_sentence ?? ''}`);
}

function extractOutputText(response: any): string {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text;
  }

  const chunks: string[] = [];
  const outputs = Array.isArray(response?.output) ? response.output : [];
  for (const out of outputs) {
    const content = Array.isArray(out?.content) ? out.content : [];
    for (const part of content) {
      if (typeof part?.text === 'string' && part.text.trim()) chunks.push(part.text);
      if (typeof part?.output_text === 'string' && part.output_text.trim()) chunks.push(part.output_text);
    }
  }

  return chunks.join('\n').trim();
}

function tryParseJson(text: string): any {
  if (!text.trim()) return { entries: [] };
  try {
    return JSON.parse(text);
  } catch {
    const codeFence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (codeFence) {
      try {
        return JSON.parse(codeFence);
      } catch {}
    }
    const braceStart = text.indexOf('{');
    const braceEnd = text.lastIndexOf('}');
    if (braceStart >= 0 && braceEnd > braceStart) {
      try {
        return JSON.parse(text.slice(braceStart, braceEnd + 1));
      } catch {}
    }
    return { entries: [] };
  }
}

function fallbackVocabularyFromText(text: string): OcrEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('{') && !line.startsWith('}') && !line.startsWith('"entries"'));

  const rows: OcrEntry[] = [];
  for (const line of lines) {
    const num = toNumber(line);
    const englishMatch = line.match(/[A-Za-z][A-Za-z\-'.() ]{1,}/);
    const english = englishMatch?.[0]?.trim() || null;
    const japaneseMatch = line.match(/[ぁ-んァ-ヶ一-龯][ぁ-んァ-ヶ一-龯A-Za-z0-9・（）()\-\s]*/);
    const japanese = japaneseMatch?.[0]?.trim() || null;
    if (english || japanese) {
      rows.push({ entry_no: num, english, japanese, example_sentence: null, part_of_speech: null });
    }
  }
  return dedupeByKey(rows, (x) => `${x.entry_no ?? ''}|${x.english ?? ''}|${x.japanese ?? ''}`);
}

async function callOpenAIForOCR(apiKey: string, prompt: string, imageUrl: string) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: imageUrl },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_object',
        },
      },
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI OCR failed: ${raw}`);
  }

  const response = JSON.parse(raw);
  const outputText = extractOutputText(response) || '{}';
  const parsed = tryParseJson(outputText);

  return { outputText, parsed, raw };
}


async function getTableColumns(env: Env, supabaseHeaders: Record<string, string>, tableName: string) {
  const url = `${env.SUPABASE_URL}/rest/v1/information_schema.columns?table_name=eq.${encodeURIComponent(tableName)}&select=column_name`;
  const res = await fetch(url, { headers: supabaseHeaders });
  const rows = await res.json().catch(() => []);
  return new Set(Array.isArray(rows) ? rows.map((r: any) => r.column_name) : []);
}

async function insertOcrRun(
  env: Env,
  supabaseHeaders: Record<string, string>,
  payload: Record<string, unknown>
) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/ocr_runs`, {
    method: 'POST',
    headers: supabaseHeaders,
    body: JSON.stringify(payload),
  });
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const env = ctx.env;
    const body = await ctx.request.json().catch(() => ({} as Record<string, unknown>));
    const materialFileId = (body?.material_file_id as string | undefined) || (body?.materialFileId as string | undefined);

    if (!materialFileId) {
      return json({ error: 'material_file_id is required' }, { status: 400 });
    }

    const supabaseHeaders = {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };

    const fileRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/material_files?id=eq.${materialFileId}&select=id,material_id,r2_key,file_url,file_name,file_type,page_number,materials(id,title,material_type)`,
      { headers: supabaseHeaders }
    );
    const fileRows = (await fileRes.json()) as MaterialFileRow[];
    const file = fileRows?.[0];

    if (!file) {
      return json({ error: 'material_file not found' }, { status: 404 });
    }

    const materialType = file.materials?.material_type || 'vocabulary_book';
    const publicUrl = resolvePublicFileUrl(file, env);

    const prompt = materialType === 'grammar_book'
      ? [
        'You are extracting grammar content from a Japanese English-learning textbook page.',
        'Return strict JSON only.',
        'Extract as many grammar points as you can. Partial extraction is better than empty output.',
        'Schema:',
        '{"entries":[{"entry_no":1,"title":"現在完了","explanation":"...","example_sentence":"...","japanese_explanation":"..."}]}',
        'If a field is unknown, use an empty string.',
        'If there are no grammar items, return {"entries":[]}.',
      ].join('\n')
      : [
        'You are extracting vocabulary from a Japanese English-learning textbook page.',
        'Return strict JSON only.',
        'Extract every visible vocabulary row you can. Partial extraction is better than empty output.',
        'Keep English word, Japanese meaning, example sentence, and part of speech when visible.',
        'If the printed number is visible, put it in entry_no. If not visible, use null.',
        'Schema:',
        '{"entries":[{"entry_no":1,"english":"abandon","japanese":"捨てる","example_sentence":"He abandoned the plan.","part_of_speech":"verb"}]}',
        'If a field is unknown, use an empty string.',
        'If there are no vocabulary rows, return {"entries":[]}.',
      ].join('\n');

    const startedAt = new Date().toISOString();
    const ocr = await callOpenAIForOCR(env.OPENAI_API_KEY, prompt, publicUrl);
    const vocabColumns = materialType === 'vocabulary_book' ? await getTableColumns(env, supabaseHeaders, 'vocabulary_entries') : new Set<string>();

    let savedCount = 0;
    let extractedCount = 0;

    if (materialType === 'grammar_book') {
      let entries = normalizeGrammarEntries(ocr.parsed.entries);
      if (entries.length === 0) {
        const fallback = fallbackVocabularyFromText(ocr.outputText);
        entries = fallback.map((row, idx) => ({
          entry_no: row.entry_no ?? idx + 1,
          title: row.english ?? `Grammar ${idx + 1}`,
          explanation: row.japanese ?? '',
          example_sentence: '',
          japanese_explanation: row.japanese ?? '',
        }));
      }
      extractedCount = entries.length;
      const payload = entries.map((e, idx) => ({
        material_id: file.material_id,
        source_file_id: file.id,
        entry_no: e.entry_no ?? ((file.page_number || 0) * 1000 + idx + 1),
        title: e.title ?? '',
        explanation: e.explanation ?? '',
        example_sentence: e.example_sentence ?? '',
        japanese_explanation: e.japanese_explanation ?? '',
        page_number: file.page_number,
        raw_ocr_text: ocr.outputText,
        is_verified: false,
      }));

      if (payload.length > 0) {
        const upsertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/grammar_entries?on_conflict=material_id,entry_no`, {
          method: 'POST',
          headers: {
            ...supabaseHeaders,
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(payload),
        });
        if (!upsertRes.ok) {
          const err = await upsertRes.text();
          await fetch(`${env.SUPABASE_URL}/rest/v1/material_files?id=eq.${file.id}`, {
            method: 'PATCH', headers: supabaseHeaders, body: JSON.stringify({ upload_status: 'ocr_failed' }),
          });
          await insertOcrRun(env, supabaseHeaders, {
            material_file_id: file.id,
            engine: 'gpt-4.1-mini',
            status: 'failed',
            created_at: startedAt,
            completed_at: new Date().toISOString(),
            error_message: `Failed to upsert grammar_entries: ${err}`,
          });
          return json({ error: `Failed to upsert grammar_entries: ${err}` }, { status: 500 });
        }
        const rows = await upsertRes.json().catch(() => []);
        savedCount = Array.isArray(rows) ? rows.length : payload.length;
      }
    } else {
      let entries = normalizeVocabularyEntries(ocr.parsed.entries);
      if (entries.length === 0) {
        entries = fallbackVocabularyFromText(ocr.outputText);
      }
      extractedCount = entries.length;
      const payload = entries.map((e, idx) => ({
        material_id: file.material_id,
        source_file_id: file.id,
        entry_no: e.entry_no ?? ((file.page_number || 0) * 1000 + idx + 1),
        english: e.english ?? '',
        japanese: e.japanese ?? '',
        ...(vocabColumns.has('example_sentence') ? { example_sentence: e.example_sentence ?? '' } : {}),
        part_of_speech: e.part_of_speech ?? '',
        page_number: file.page_number,
        raw_ocr_text: ocr.outputText,
        is_verified: false,
      }));

      if (payload.length > 0) {
        const upsertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/vocabulary_entries?on_conflict=material_id,entry_no`, {
          method: 'POST',
          headers: {
            ...supabaseHeaders,
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(payload),
        });
        if (!upsertRes.ok) {
          const err = await upsertRes.text();
          await fetch(`${env.SUPABASE_URL}/rest/v1/material_files?id=eq.${file.id}`, {
            method: 'PATCH', headers: supabaseHeaders, body: JSON.stringify({ upload_status: 'ocr_failed' }),
          });
          await insertOcrRun(env, supabaseHeaders, {
            material_file_id: file.id,
            engine: 'gpt-4.1-mini',
            status: 'failed',
            created_at: startedAt,
            completed_at: new Date().toISOString(),
            error_message: `Failed to upsert vocabulary_entries: ${err}`,
          });
          return json({ error: `Failed to upsert vocabulary_entries: ${err}` }, { status: 500 });
        }
        const rows = await upsertRes.json().catch(() => []);
        savedCount = Array.isArray(rows) ? rows.length : payload.length;
      }
    }

    const finalStatus = savedCount > 0 ? 'processed' : 'ocr_empty';
    const finalErrorMessage = savedCount > 0
      ? null
      : `No entries extracted. Raw OCR text preview: ${ocr.outputText.slice(0, 400)}`;

    await fetch(`${env.SUPABASE_URL}/rest/v1/material_files?id=eq.${file.id}`, {
      method: 'PATCH',
      headers: supabaseHeaders,
      body: JSON.stringify({ upload_status: finalStatus }),
    });

    await insertOcrRun(env, supabaseHeaders, {
      material_file_id: file.id,
      engine: 'gpt-4.1-mini',
      status: savedCount > 0 ? 'completed' : 'empty',
      created_at: startedAt,
      completed_at: new Date().toISOString(),
      error_message: finalErrorMessage,
    });

    return json({
      ok: true,
      material_file_id: file.id,
      page_number: file.page_number,
      public_url: publicUrl,
      extracted_count: extractedCount,
      saved_count: savedCount,
      output_preview: ocr.outputText.slice(0, 1000),
    });
  } catch (error: any) {
    return json({ error: error?.message || 'OCR failed' }, { status: 500 });
  }
};
