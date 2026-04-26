// @ts-nocheck
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

type RequestPayload = {
  rosterPersonId?: string;
  screenshotPath?: string;
};

const MODEL =
  Deno.env.get('ANTHROPIC_TEXT_MODEL') ?? 'claude-sonnet-4-20250514';
const VISION_MODEL =
  Deno.env.get('ANTHROPIC_VISION_MODEL') ?? 'claude-sonnet-4-20250514';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive',
    },
  });
}

function parseJsonObject(input: string) {
  const cleaned = input.trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse(401, { error: 'Missing Authorization header' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !anthropicKey) {
    return jsonResponse(500, { error: 'Missing required environment secrets.' });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  let body: RequestPayload;
  try {
    body = (await req.json()) as RequestPayload;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const rosterPersonId = body.rosterPersonId?.trim();
  const screenshotPath = body.screenshotPath?.trim();
  if (!rosterPersonId || !screenshotPath) {
    return jsonResponse(400, {
      error: 'rosterPersonId and screenshotPath are required',
    });
  }

  const { data: rosterPerson, error: rosterError } = await adminClient
    .from('roster_people')
    .select('id, owner_id')
    .eq('id', rosterPersonId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (rosterError || !rosterPerson) {
    return jsonResponse(404, { error: 'Roster person not found' });
  }

  const { data: fileData, error: downloadError } = await adminClient.storage
    .from('chat-screenshots')
    .download(screenshotPath);
  if (downloadError || !fileData) {
    return jsonResponse(400, { error: 'Unable to read uploaded screenshot file' });
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());
  const base64Image = encodeBase64(bytes);
  if (!base64Image) {
    return jsonResponse(400, { error: 'Uploaded screenshot produced empty base64 data.' });
  }
  console.log(
    JSON.stringify({
      stage: 'ocr_start',
      userId: user.id,
      rosterPersonId,
      screenshotPath,
      bytes: bytes.length,
      model: VISION_MODEL,
    }),
  );

  const visionRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 1200,
      system:
        'You are an OCR extraction assistant. Return exact visible chat text only, preserving speaker order and line breaks where possible.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: fileData.type || 'image/jpeg',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: 'Extract all readable text from this chat screenshot. Return only raw extracted text.',
            },
          ],
        },
      ],
    }),
  });

  if (!visionRes.ok) {
    const message = await visionRes.text();
    console.error(
      JSON.stringify({
        stage: 'ocr_failed',
        status: visionRes.status,
        body: message,
      }),
    );
    return jsonResponse(502, { error: `Claude vision failed: ${message}` });
  }

  const visionJson = await visionRes.json();
  const ocrText = Array.isArray(visionJson.content)
    ? visionJson.content
        .map((chunk: { type?: string; text?: string }) =>
          chunk.type === 'text' ? chunk.text ?? '' : '',
        )
        .join('\n')
        .trim()
    : '';

  const summaryRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1400,
      system:
        'You summarize dating chat screenshots cautiously. Avoid accusations. Focus on observable communication patterns.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Given this OCR text, return strict JSON only with keys: summary (string), openingLine (string), redFlags (string[]), greenFlags (string[]).\n' +
                'Use cautious language, avoid definitive harmful claims.\n\nOCR:\n' +
                (ocrText || '[No text detected]'),
            },
          ],
        },
      ],
    }),
  });

  if (!summaryRes.ok) {
    const message = await summaryRes.text();
    console.error(
      JSON.stringify({
        stage: 'summary_failed',
        status: summaryRes.status,
        body: message,
      }),
    );
    return jsonResponse(502, { error: `Claude summary failed: ${message}` });
  }

  const summaryJson = await summaryRes.json();
  const summaryText = Array.isArray(summaryJson.content)
    ? summaryJson.content
        .map((chunk: { type?: string; text?: string }) =>
          chunk.type === 'text' ? chunk.text ?? '' : '',
        )
        .join('\n')
        .trim()
    : '';

  const parsed = parseJsonObject(summaryText) as {
    summary?: string;
    openingLine?: string;
    redFlags?: string[];
    greenFlags?: string[];
  } | null;

  const summary = parsed?.summary?.trim() || 'No summary returned.';
  const openingLine = parsed?.openingLine?.trim() || null;
  const redFlags = Array.isArray(parsed?.redFlags)
    ? parsed!.redFlags.filter((v) => typeof v === 'string' && v.trim().length > 0)
    : [];
  const greenFlags = Array.isArray(parsed?.greenFlags)
    ? parsed!.greenFlags.filter((v) => typeof v === 'string' && v.trim().length > 0)
    : [];

  const screenshotUrl = `${supabaseUrl}/storage/v1/object/chat-screenshots/${screenshotPath}`;
  const { data: inserted, error: insertError } = await adminClient
    .from('chat_uploads')
    .insert({
      owner_id: user.id,
      roster_person_id: rosterPersonId,
      screenshot_url: screenshotUrl,
      ocr_text: ocrText || null,
      ai_summary: summary,
      opening_line: openingLine,
      red_flags: redFlags,
      green_flags: greenFlags,
    })
    .select('id, ocr_text, ai_summary, opening_line, red_flags, green_flags')
    .single();

  if (insertError) {
    console.error(
      JSON.stringify({
        stage: 'db_insert_failed',
        error: insertError.message,
      }),
    );
    return jsonResponse(500, { error: insertError.message });
  }

  console.log(
    JSON.stringify({
      stage: 'complete',
      uploadId: inserted.id,
      redFlagsCount: inserted.red_flags?.length ?? 0,
      greenFlagsCount: inserted.green_flags?.length ?? 0,
    }),
  );

  return jsonResponse(200, {
    ocrText: inserted.ocr_text ?? '',
    summary: inserted.ai_summary ?? '',
    openingLine: inserted.opening_line ?? null,
    redFlags: inserted.red_flags ?? [],
    greenFlags: inserted.green_flags ?? [],
  });
});
