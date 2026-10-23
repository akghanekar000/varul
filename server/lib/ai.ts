import { z } from 'zod';

export const AI_PROVIDER_NAMES = ['openai', 'anthropic', 'google'] as const;
export type SupportedAiProvider = (typeof AI_PROVIDER_NAMES)[number];

export const aiChatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  projectId: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .transform((value) => value || undefined)
});

export const DEFAULT_MODEL_BY_PROVIDER: Record<SupportedAiProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  google: 'gemini-1.5-flash'
};

export type ProviderStatus = {
  name: SupportedAiProvider;
  key: string;
  enabled: boolean;
  defaultModel: string;
  supportsStreaming: boolean;
};

export type ProviderConfig = {
  provider: SupportedAiProvider;
  apiKey: string | undefined;
  model: string;
  defaultModel: string;
  configured: boolean;
};

export type AiResponseStatus = 'ok' | 'config-required' | 'provider-error' | 'timeout' | 'runtime-error';

export type AiResponse = {
  status: AiResponseStatus;
  provider: string;
  model: string | null;
  reply: string;
  usage: Record<string, unknown> | null;
  fallback?: {
    status: 'fallback';
    provider: 'local-planner';
    model: 'devmind-agent';
    reply: string;
    usage: null;
  };
  error?: string;
  details?: unknown;
};

export function normalizeProvider(value?: string): SupportedAiProvider {
  const normalized = (value ?? 'openai').trim().toLowerCase();
  if ((AI_PROVIDER_NAMES as readonly string[]).includes(normalized)) {
    return normalized as SupportedAiProvider;
  }
  return 'openai';
}

export function resolveAiProviderConfig(env: NodeJS.ProcessEnv = process.env): ProviderConfig {
  const provider = normalizeProvider(env.AI_PROVIDER);
  const model =
    (env[`${provider.toUpperCase()}_MODEL`] ?? DEFAULT_MODEL_BY_PROVIDER[provider])?.trim() ||
    DEFAULT_MODEL_BY_PROVIDER[provider];
  const apiKey = env[`${provider.toUpperCase()}_API_KEY`]?.trim() || undefined;

  return {
    provider,
    apiKey,
    model,
    defaultModel: DEFAULT_MODEL_BY_PROVIDER[provider],
    configured: Boolean(apiKey)
  };
}

export function getAiSetupGuide(env: NodeJS.ProcessEnv = process.env) {
  const providers: ProviderStatus[] = AI_PROVIDER_NAMES.map((provider) => ({
    name: provider,
    key: `${provider.toUpperCase()}_API_KEY`,
    enabled: Boolean(env[`${provider.toUpperCase()}_API_KEY`]?.trim()),
    defaultModel: DEFAULT_MODEL_BY_PROVIDER[provider],
    supportsStreaming: true
  }));

  const configured = providers.filter((provider) => provider.enabled);

  return {
    status: configured.length === 0 ? 'missing' : configured.length === providers.length ? 'configured' : 'partial',
    providers,
    message:
      configured.length === 0
        ? 'No AI provider credentials were detected. Add OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY in the server environment to enable live model access.'
        : configured.length === providers.length
          ? 'All supported AI provider credentials are configured. The server can call the selected provider.'
          : 'Some AI provider credentials are configured. Review the selected provider and model before making live requests.',
    configuredCount: configured.length
  };
}

export function redactSecrets(value: unknown): string {
  const raw = typeof value === 'string' ? value : JSON.stringify(value ?? {});

  return raw
    .replace(/(sk-[A-Za-z0-9]+)/gi, '[REDACTED]')
    .replace(/(Bearer\s+[A-Za-z0-9._-]+)/gi, 'Bearer [REDACTED]')
    .replace(/(AIza[0-9A-Za-z\-_]{10,})/gi, '[REDACTED]')
    .replace(/("apiKey"\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3')
    .replace(/(Authorization\s*:\s*\"?Bearer\s+[A-Za-z0-9._-]+)/gi, 'Authorization: Bearer [REDACTED]');
}

export function buildPlannerReply(message: string): AiResponse['fallback'] {
  const cleaned = message.trim() || 'your request';

  return {
    status: 'fallback',
    provider: 'local-planner',
    model: 'devmind-agent',
    reply: `I can help with: ${cleaned}\n\nImplementation plan:\n1. Clarify the target user and constraints.\n2. Inspect the relevant files and project structure.\n3. Draft a bounded patch with a clear diff.\n4. Review the change and run the relevant checks.\n5. Report verified results and any remaining limitations.`,
    usage: null
  };
}

function extractReply(provider: SupportedAiProvider, payload: any): string | undefined {
  if (provider === 'openai') {
    const text = payload?.choices?.[0]?.message?.content;
    if (Array.isArray(text)) {
      return text.map((part: any) => part?.text ?? '').join('');
    }
    return typeof text === 'string' ? text : undefined;
  }

  if (provider === 'anthropic') {
    const value = payload?.content;
    const text = Array.isArray(value)
      ? value.map((part: any) => part?.text ?? '').join('')
      : typeof value === 'string'
        ? value
        : undefined;
    return text || undefined;
  }

  const parts = payload?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts)
    ? parts.map((part: any) => part?.text ?? '').join('') || undefined
    : undefined;
}

export function createProviderRequest(provider: SupportedAiProvider, message: string, model: string, apiKey: string) {
  switch (provider) {
    case 'openai':
      return {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        payload: {
          model,
          messages: [{ role: 'user', content: message }],
          temperature: 0.2
        }
      };
    case 'anthropic':
      return {
        endpoint: 'https://api.anthropic.com/v1/messages',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        payload: {
          model,
          max_tokens: 800,
          messages: [{ role: 'user', content: message }]
        }
      };
    case 'google':
      return {
        endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        payload: {
          contents: [{ parts: [{ text: message }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800
          }
        }
      };
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

export async function callAiProvider({
  message,
  provider,
  apiKey,
  model,
  fetchImpl = globalThis.fetch,
  timeoutMs = 30000
}: {
  message: string;
  provider: SupportedAiProvider;
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<AiResponse> {
  const selectedProvider = normalizeProvider(provider);
  const selectedModel =
    (model || DEFAULT_MODEL_BY_PROVIDER[selectedProvider] || '').trim() || DEFAULT_MODEL_BY_PROVIDER[selectedProvider];

  if (!apiKey || !apiKey.trim()) {
    return {
      status: 'config-required',
      provider: selectedProvider,
      model: selectedModel,
      reply: buildPlannerReply(message).reply,
      usage: null,
      fallback: buildPlannerReply(message),
      error: 'Missing API key',
      details: { provider: selectedProvider, expectedEnv: `${selectedProvider.toUpperCase()}_API_KEY` }
    };
  }

  const request = createProviderRequest(selectedProvider, message, selectedModel, apiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(request.endpoint, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.payload),
      signal: controller.signal
    });

    const responseText = await response.text();
    let parsed: any = null;

    try {
      parsed = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsed = null;
    }

    if (response.status === 429) {
      return {
        status: 'provider-error',
        provider: selectedProvider,
        model: selectedModel,
        reply: buildPlannerReply(message).reply,
        usage: null,
        fallback: buildPlannerReply(message),
        error: 'Rate limit exceeded',
        details: redactSecrets(parsed ?? responseText)
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        status: 'provider-error',
        provider: selectedProvider,
        model: selectedModel,
        reply: buildPlannerReply(message).reply,
        usage: null,
        fallback: buildPlannerReply(message),
        error: 'Invalid API key',
        details: redactSecrets(parsed ?? responseText)
      };
    }

    if (!response.ok) {
      return {
        status: 'provider-error',
        provider: selectedProvider,
        model: selectedModel,
        reply: buildPlannerReply(message).reply,
        usage: null,
        fallback: buildPlannerReply(message),
        error: 'Provider request failed',
        details: redactSecrets(parsed ?? responseText)
      };
    }

    const reply = extractReply(selectedProvider, parsed);
    if (!reply || !reply.trim()) {
      return {
        status: 'provider-error',
        provider: selectedProvider,
        model: selectedModel,
        reply: buildPlannerReply(message).reply,
        usage: null,
        fallback: buildPlannerReply(message),
        error: 'Invalid response format',
        details: redactSecrets(parsed ?? responseText)
      };
    }

    return {
      status: 'ok',
      provider: selectedProvider,
      model: selectedModel,
      reply,
      usage: parsed?.usage ?? null,
      error: undefined,
      details: undefined
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        status: 'timeout',
        provider: selectedProvider,
        model: selectedModel,
        reply: buildPlannerReply(message).reply,
        usage: null,
        fallback: buildPlannerReply(message),
        error: 'Request timed out',
        details: 'AI request exceeded the timeout window.'
      };
    }

    return {
      status: 'runtime-error',
      provider: selectedProvider,
      model: selectedModel,
      reply: buildPlannerReply(message).reply,
      usage: null,
      fallback: buildPlannerReply(message),
      error: error instanceof Error ? error.message : 'Unknown error',
      details: redactSecrets(error instanceof Error ? error.message : String(error))
    };
  } finally {
    clearTimeout(timer);
  }
}

export function toHttpResponse(body: AiResponse) {
  const statusCode = body.status === 'provider-error' ? 502 : body.status === 'timeout' ? 504 : body.status === 'runtime-error' ? 500 : 200;
  return {
    statusCode,
    payload: {
      ...body,
      fallback: body.fallback ?? null,
      details: body.details ? redactSecrets(body.details) : undefined
    }
  };
}
