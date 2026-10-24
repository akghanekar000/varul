import { z } from 'zod';

export const aiChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  projectId: z.string().optional()
});

export type ProviderName = 'openai' | 'anthropic' | 'google' | 'huggingface';

export const providerStatus = [
  { name: 'openai', key: 'OPENAI_API_KEY', enabled: Boolean(process.env.OPENAI_API_KEY) },
  { name: 'anthropic', key: 'ANTHROPIC_API_KEY', enabled: Boolean(process.env.ANTHROPIC_API_KEY) },
  { name: 'google', key: 'GOOGLE_API_KEY', enabled: Boolean(process.env.GOOGLE_API_KEY) },
  { name: 'huggingface', key: 'HF_TOKEN', enabled: Boolean(process.env.HF_TOKEN) }
];

export function getAiSetupGuide() {
  const configured = providerStatus.filter((provider) => provider.enabled);

  return {
    status: configured.length ? 'partial' : 'missing',
    providers: providerStatus,
    message:
      configured.length > 0
        ? 'AI provider credentials are partially configured. Review the env values and restart the server.'
        : 'No AI provider credentials were detected. Add OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, or HF_TOKEN in the server environment to enable live model access.'
  };
}

export function getConfiguredProviderName(providerOverride?: string) {
  const requested = (providerOverride ?? process.env.AI_PROVIDER ?? 'huggingface').trim().toLowerCase();

  if (requested === 'hf' || requested === 'huggingface') {
    return 'huggingface';
  }

  if (requested === 'openai') {
    return 'openai';
  }

  if (requested === 'anthropic') {
    return 'anthropic';
  }

  if (requested === 'google') {
    return 'google';
  }

  if (process.env.HF_TOKEN) {
    return 'huggingface';
  }

  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return 'anthropic';
  }

  if (process.env.GOOGLE_API_KEY) {
    return 'google';
  }

  return 'huggingface';
}

export function getProviderConfig(providerOverride?: string) {
  const providerName = getConfiguredProviderName(providerOverride);
  const provider = providerName;

  const apiKey = provider === 'huggingface'
    ? process.env.HF_TOKEN
    : process.env[`${provider.toUpperCase()}_API_KEY`];

  const model = provider === 'openai'
    ? process.env.OPENAI_MODEL || 'gpt-4o-mini'
    : provider === 'anthropic'
      ? process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
      : provider === 'google'
        ? process.env.GOOGLE_MODEL || 'gemini-1.5-flash'
        : process.env.HF_MODEL || 'Qwen/Qwen2.5-Coder-7B-Instruct';

  return {
    provider,
    model,
    apiKey,
    isConfigured: Boolean(apiKey)
  };
}

export function buildProviderRequest(providerOverride: string, message: string) {
  const provider = getConfiguredProviderName(providerOverride);
  const config = getProviderConfig(provider);

  if (!config || !config.apiKey) {
    throw new Error(`No API key configured for ${provider}.`);
  }

  const normalizedProvider = provider === 'huggingface' ? 'huggingface' : provider;

  if (normalizedProvider === 'openai') {
    return {
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: config.model,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: {
        model: config.model,
        messages: [{ role: 'user', content: message }],
        temperature: 0.2,
        max_tokens: 800
      }
    };
  }

  if (normalizedProvider === 'anthropic') {
    return {
      provider: 'anthropic',
      endpoint: 'https://api.anthropic.com/v1/messages',
      model: config.model,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: {
        model: config.model,
        max_tokens: 800,
        temperature: 0.2,
        messages: [{ role: 'user', content: message }]
      }
    };
  }

  if (normalizedProvider === 'google') {
    return {
      provider: 'google',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      model: config.model,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey
      },
      body: {
        contents: [{ parts: [{ text: message }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 800 }
      }
    };
  }

  return {
    provider: 'huggingface',
    endpoint: 'https://router.huggingface.co/v1/chat/completions',
    model: config.model,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: {
      model: config.model,
      messages: [{ role: 'user', content: message }],
      temperature: 0.2,
      max_tokens: 800
    }
  };
}

export function extractProviderReply(providerName: string, body: unknown) {
  const normalized = (providerName || '').toLowerCase();

  if (normalized === 'openai') {
    return typeof body === 'object' && body !== null && 'choices' in body
      ? (body as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? null
      : null;
  }

  if (normalized === 'anthropic') {
    return typeof body === 'object' && body !== null && 'content' in body
      ? (body as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? null
      : null;
  }

  if (normalized === 'google') {
    if (typeof body !== 'object' || body === null || !('candidates' in body)) {
      return null;
    }

    const candidates = (body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates ?? [];
    const joined = candidates
      .map((candidate) => candidate.content?.parts?.map((part) => part.text ?? '').join('') ?? '')
      .join('');

    return joined || null;
  }

  if (normalized === 'huggingface') {
    return typeof body === 'object' && body !== null && 'choices' in body
      ? (body as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? null
      : null;
  }

  return null;
}

export function normalizeUsage(body: unknown) {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const usage = (body as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage;
  if (!usage) {
    return null;
  }

  return {
    promptTokens: usage.prompt_tokens ?? null,
    completionTokens: usage.completion_tokens ?? null,
    totalTokens: usage.total_tokens ?? null
  };
}

export function redactSecret(value: string | undefined) {
  if (!value) {
    return 'not-configured';
  }

  if (value.length <= 8) {
    return '***';
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function isTimeoutError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AbortError');
}

export function buildPlannerReply(message: string) {
  const cleaned = message.trim();

  return {
    status: 'ready',
    message: `I can help with: ${cleaned}.\n\nImplementation plan:\n1. Clarify the target user, scope, and constraints.\n2. Map the required files and architecture.\n3. Draft the patch, review risks, and validate the relevant checks.\n4. Keep the work bounded and report actual verification results.\n5. Apply only approved changes and document any remaining gap.`,
    provider: 'local-planner',
    model: 'devmind-agent'
  };
}

export function normalizeProviderError(statusCode: number | undefined, body: unknown, provider: string) {
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  const safeText = text.length > 500 ? `${text.slice(0, 500)}...` : text;

  if (statusCode === 401 || statusCode === 403) {
    return {
      status: 'provider-error',
      provider,
      error: 'provider_auth_failed',
      message: 'The configured AI provider rejected the server API key.',
      details: 'Authentication failed. The API key is valid on the server only and was not exposed to the browser.'
    };
  }

  if (statusCode === 429) {
    return {
      status: 'provider-error',
      provider,
      error: 'rate_limited',
      message: 'The provider rate limit was exceeded.',
      details: 'Retry later or use a different model or provider configuration.'
    };
  }

  if (statusCode === 400) {
    return {
      status: 'provider-error',
      provider,
      error: 'invalid_request',
      message: 'The provider rejected the request format.',
      details: safeText
    };
  }

  if (statusCode && statusCode >= 500) {
    return {
      status: 'provider-error',
      provider,
      error: 'provider_failure',
      message: 'The provider returned a server error.',
      details: safeText
    };
  }

  return {
    status: 'provider-error',
    provider,
    error: 'provider_unavailable',
    message: 'The provider request failed unexpectedly.',
    details: safeText
  };
}
