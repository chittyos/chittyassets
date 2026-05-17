// @canon: chittycanon://core/services/chittyassets
// OpenAI HTTP client — Workers-compatible (uses global fetch, NO node SDK).
//
// Phase 3c: backs /api/evidence/:evidenceId/analyze, /api/legal/generate-document,
// /api/assets/:assetId/calculate-trust-score.
//
// Per chittycanon://gov/governance#core-types — OpenAI is a Tool (T) consumed
// by a Person (P) caller to produce Event (E) records (ai_analysis_results).
// Authority (A) and Location (L) are not exercised by this client. All five
// P/L/T/E/A remain enumerated in env.ts.
//
// 3s per-call timeout via AbortController. No retries — caller's concern.
// API key is a Worker secret; if unset, callers must surface 503.

import type { Env } from "../env";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o";

export class OpenAIClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "OpenAIClientError";
  }
}

export class OpenAIConfigError extends Error {
  constructor() {
    super("OPENAI_API_KEY not configured");
    this.name = "OpenAIConfigError";
  }
}

type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
    };

interface ChatRequest {
  messages: ChatMessage[];
  responseFormat?: "json_object" | "text";
  maxTokens?: number;
  timeoutMs?: number;
}

interface ChatResponse {
  content: string;
}

export async function chatCompletion(
  env: Env,
  req: ChatRequest,
): Promise<ChatResponse> {
  if (!env.OPENAI_API_KEY) throw new OpenAIConfigError();
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new Error("timeout")),
    req.timeoutMs ?? 3000,
  );
  try {
    const body: Record<string, unknown> = {
      model: MODEL,
      messages: req.messages,
      max_tokens: req.maxTokens ?? 1000,
    };
    if (req.responseFormat === "json_object") {
      body.response_format = { type: "json_object" };
    }
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new OpenAIClientError(
        `OpenAI returned ${res.status}`,
        res.status,
      );
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    return { content };
  } catch (err) {
    if (err instanceof OpenAIClientError || err instanceof OpenAIConfigError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new OpenAIClientError(`openai fetch failed: ${msg}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

// -----------------------------------------------------------------------
// High-level helpers — mirror server/aiAnalysis.ts prompts verbatim so the
// migration is semantically identical to Express.
// -----------------------------------------------------------------------

export async function analyzeReceipt(env: Env, base64Image: string) {
  const { content } = await chatCompletion(env, {
    responseFormat: "json_object",
    maxTokens: 1000,
    messages: [
      {
        role: "system",
        content: `You are an expert receipt analyzer. Analyze the receipt image and extract structured data.
                     Respond with JSON in this exact format: {
                       "merchant": string,
                       "amount": number,
                       "currency": string,
                       "date": string (ISO format),
                       "items": [{"description": string, "quantity": number, "price": number}],
                       "taxAmount": number,
                       "confidence": number (0-1),
                       "category": string
                     }`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this receipt and extract all the key information including merchant, total amount, date, individual items, and tax amount.",
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
        ],
      },
    ],
  });
  return JSON.parse(content || "{}");
}

export async function analyzeDocument(env: Env, base64Image: string) {
  const { content } = await chatCompletion(env, {
    responseFormat: "json_object",
    maxTokens: 1500,
    messages: [
      {
        role: "system",
        content: `You are an expert document analyzer. Analyze the document image and extract structured data.
                     Respond with JSON in this exact format: {
                       "documentType": string,
                       "keyFields": object,
                       "confidence": number (0-1),
                       "summary": string,
                       "extractedText": string
                     }`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this document and extract the document type, key fields, and provide a summary of the content.",
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
        ],
      },
    ],
  });
  return JSON.parse(content || "{}");
}

export async function analyzeAssetPhoto(
  env: Env,
  base64Image: string,
  assetType: string,
) {
  const { content } = await chatCompletion(env, {
    responseFormat: "json_object",
    maxTokens: 1000,
    messages: [
      {
        role: "system",
        content: `You are an expert asset appraiser. Analyze the asset photo and provide valuation insights.
                     Respond with JSON in this exact format: {
                       "estimatedValue": number,
                       "currency": string,
                       "confidence": number (0-1),
                       "factors": [string],
                       "marketComparisons": [{"source": string, "price": number, "similarity": number}]
                     }`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this ${assetType} photo and provide an estimated value based on visible condition, brand, model, and other factors. Include factors that influenced your valuation.`,
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
        ],
      },
    ],
  });
  return JSON.parse(content || "{}");
}

export async function generateLegalDocument(
  env: Env,
  templateType: string,
  assetData: unknown,
  jurisdiction: string,
): Promise<string> {
  const { content } = await chatCompletion(env, {
    maxTokens: 2000,
    timeoutMs: 8000, // long-form generation needs more headroom
    messages: [
      {
        role: "system",
        content: `You are an expert legal document generator. Generate a professional ${templateType} document for ${jurisdiction} jurisdiction. Use proper legal formatting and language.`,
      },
      {
        role: "user",
        content: `Generate a ${templateType} document with the following asset information: ${JSON.stringify(assetData)}. Include all necessary legal clauses and make it court-ready.`,
      },
    ],
  });
  return content;
}

/**
 * Calculate trust score via OpenAI. Mirrors Express server/aiAnalysis.ts
 * verbatim — returns 0..100 float. NOTE: the assets.trust_score column is
 * numeric(3,1) so callers must cap at 99.9 before INSERT/UPDATE.
 */
export async function calculateTrustScore(
  env: Env,
  asset: unknown,
  evidenceItems: unknown[],
): Promise<{ trustScore: number; factors: string[] }> {
  const { content } = await chatCompletion(env, {
    responseFormat: "json_object",
    maxTokens: 500,
    messages: [
      {
        role: "system",
        content: `You are a trust scoring expert. Analyze the asset and evidence data to calculate a trust score from 0.0 to 100.0.
                     Respond with JSON: {"trustScore": number, "factors": [string]}`,
      },
      {
        role: "user",
        content: `Calculate trust score for this asset: ${JSON.stringify(asset)} with evidence: ${JSON.stringify(evidenceItems)}. Consider verification status, documentation completeness, blockchain verification, and source credibility.`,
      },
    ],
  });
  const parsed = JSON.parse(content || '{"trustScore":0,"factors":[]}');
  const raw = Number(parsed.trustScore ?? 0);
  return {
    trustScore: Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0)),
    factors: Array.isArray(parsed.factors) ? parsed.factors : [],
  };
}
