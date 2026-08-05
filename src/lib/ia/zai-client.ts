// Z.ai LLM Client — Server-side only
// v2.0 — Public API with model selection, fallback, and comprehensive logging
//
// Key discovery: The SDK internal API does NOT support model selection.
// We use the public API directly: https://api.z.ai/api/paas/v4/chat/completions

const ZAI_API_BASE = 'https://api.z.ai/api/paas/v4';

// ============================================================
// MODEL CONFIGURATION
// ============================================================

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  isFree: boolean;
  capabilities: string[];
  maxTokens: number;
  priority: number; // lower = higher priority (primary)
  enabled: boolean;
}

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: 'glm-4.5-flash',
    name: 'GLM-4.5 Flash',
    provider: 'Zhipu AI',
    isFree: true,
    capabilities: ['chat', 'reasoning', 'analysis', 'function-calling'],
    maxTokens: 4096,
    priority: 1,
    enabled: true,
  },
  {
    id: 'glm-4.7-flash',
    name: 'GLM-4.7 Flash',
    provider: 'Zhipu AI',
    isFree: true,
    capabilities: ['chat', 'reasoning', 'analysis'],
    maxTokens: 4096,
    priority: 2,
    enabled: true,
  },
  {
    id: 'glm-4.6v-flash',
    name: 'GLM-4.6V Flash',
    provider: 'Zhipu AI',
    isFree: true,
    capabilities: ['chat', 'vision', 'ocr'],
    maxTokens: 4096,
    priority: 3,
    enabled: false, // Vision model, only enable for vision tasks
  },
];

// ============================================================
// LOGGING
// ============================================================

export interface AICallLog {
  id: string;
  timestamp: string;
  model: string;
  provider: string;
  function: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  responseTimeMs: number;
  status: 'success' | 'error' | 'timeout' | 'fallback';
  error?: string;
  fallbackFrom?: string;
  fallbackTo?: string;
}

// In-memory log ring buffer (last 500 calls)
const MAX_LOGS = 500;
const aiCallLogs: AICallLog[] = [];

export function getAICallLogs(): AICallLog[] {
  return [...aiCallLogs];
}

export function getAICallStats() {
  const total = aiCallLogs.length;
  const successes = aiCallLogs.filter(l => l.status === 'success').length;
  const errors = aiCallLogs.filter(l => l.status === 'error' || l.status === 'timeout').length;
  const fallbacks = aiCallLogs.filter(l => l.status === 'fallback').length;
  const avgResponseTime = total > 0
    ? Math.round(aiCallLogs.reduce((s, l) => s + l.responseTimeMs, 0) / total)
    : 0;
  const totalTokens = aiCallLogs.reduce((s, l) => s + l.totalTokens, 0);

  const byModel: Record<string, { calls: number; success: number; avgMs: number }> = {};
  for (const log of aiCallLogs) {
    if (!byModel[log.model]) byModel[log.model] = { calls: 0, success: 0, avgMs: 0 };
    byModel[log.model].calls++;
    if (log.status === 'success') byModel[log.model].success++;
  }
  for (const m of Object.values(byModel)) {
    m.avgMs = m.calls > 0 ? Math.round(m.calls / m.calls * 100) : 0;
  }

  return { total, successes, errors, fallbacks, avgResponseTime, totalTokens, byModel };
}

function addLog(log: AICallLog) {
  aiCallLogs.push(log);
  if (aiCallLogs.length > MAX_LOGS) aiCallLogs.shift();
  // Also log to console in production
  if (log.status === 'error') {
    console.error(`[ZAI] ${log.status} | model=${log.model} | ${log.responseTimeMs}ms | ${log.error}`);
  } else {
    console.log(`[ZAI] ${log.status} | model=${log.model} | ${log.responseTimeMs}ms | tokens=${log.totalTokens}`);
  }
}

// ============================================================
// CORE API CALL
// ============================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ZAIResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
  };
  model: string;
  created: number;
}

async function callZAI(
  messages: ChatMessage[],
  modelId: string,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<{ content: string; usage: any; responseTimeMs: number }> {
  const startTime = Date.now();
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) throw new Error('ZAI_API_KEY is not configured');

  const response = await fetch(`${ZAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 4096,
    }),
    signal: AbortSignal.timeout(60000), // 60s timeout
  });

  const responseTimeMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`ZAI API ${response.status}: ${errorText}`);
  }

  const data: ZAIResponse = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  return {
    content,
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    responseTimeMs,
  };
}

// ============================================================
// PUBLIC API WITH FALLBACK
// ============================================================

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  function?: string; // Label for logging
  enableFallback?: boolean;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<string> {
  const functionName = options?.function || 'unknown';
  const enableFallback = options?.enableFallback !== false;

  // Determine model order
  const models = getEnabledModels(options?.model);

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const isLast = i === models.length - 1;

    try {
      const result = await callZAI(messages, model.id, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens ?? model.maxTokens,
      });

      addLog({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        model: model.id,
        provider: model.provider,
        function: functionName,
        inputTokens: result.usage.prompt_tokens,
        outputTokens: result.usage.completion_tokens,
        totalTokens: result.usage.total_tokens,
        responseTimeMs: result.responseTimeMs,
        status: i > 0 ? 'fallback' : 'success',
        fallbackFrom: i > 0 ? models[i - 1].id : undefined,
        fallbackTo: i > 0 ? model.id : undefined,
      });

      return result.content;
    } catch (error: any) {
      const logStatus = error.message?.includes('timeout') || error.message?.includes('AbortSignal')
        ? 'timeout' as const
        : 'error' as const;

      addLog({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        model: model.id,
        provider: model.provider,
        function: functionName,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        responseTimeMs: 0,
        status: logStatus,
        error: error.message?.slice(0, 200),
      });

      if (isLast || !enableFallback) {
        throw new Error(`All AI models failed. Last error (${model.id}): ${error.message}`);
      }

      console.warn(`[ZAI] Model ${model.id} failed, falling back to ${models[i + 1]?.id}...`);
    }
  }

  throw new Error('No AI models available');
}

function getEnabledModels(preferredModel?: string): ModelConfig[] {
  if (preferredModel) {
    const pref = AVAILABLE_MODELS.find(m => m.id === preferredModel && m.enabled);
    if (pref) {
      // Return preferred first, then others as fallbacks
      return [pref, ...AVAILABLE_MODELS.filter(m => m.id !== preferredModel && m.enabled)]
        .sort((a, b) => a.priority - b.priority);
    }
  }
  return AVAILABLE_MODELS.filter(m => m.enabled).sort((a, b) => a.priority - b.priority);
}

// ============================================================
// JSON EXTRACTION
// ============================================================

/** Extract JSON from raw LLM output — handles markdown, code blocks, extra text */
export function extractJSONFromRaw(raw: string): any {
  // 1. Try direct parse
  try { return JSON.parse(raw.trim()); } catch {}

  // 2. Try extracting from ```json ... ``` or ``` ... ```
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()); } catch {}
  }

  // 3. Find outermost { } or [ ]
  let start = -1;
  let openChar = '';
  let closeChar = '';

  const braceIdx = raw.indexOf('{');
  const bracketIdx = raw.indexOf('[');

  if (braceIdx !== -1 && (bracketIdx === -1 || braceIdx < bracketIdx)) {
    start = braceIdx; openChar = '{'; closeChar = '}';
  } else if (bracketIdx !== -1) {
    start = bracketIdx; openChar = '['; closeChar = ']';
  }

  if (start !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\') { if (inString) escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === openChar) depth++;
      if (ch === closeChar) depth--;
      if (depth === 0) {
        try { return JSON.parse(raw.slice(start, i + 1)); } catch {}
        break;
      }
    }
  }

  throw new Error('Impossible de parser la reponse JSON du LLM. Reponse brute: ' + raw.slice(0, 200));
}
