import { z } from 'zod';

export const AI_PROVIDER_NAMES = ['openai', 'anthropic', 'google'] as const;
export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

export const aiChatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  projectId: z.string().trim().max(120).optional(),
  stream: z.boolean().optional().default(false)
});

export const providerStatus = AI_PROVIDER_NAMES.map((name) => ({
  name,
  key: `${name.toUpperCase()}_API_KEY`,
  enabled: Boolean(process.env[`${name.toUpperCase()}_API_KEY`])
}));

export function normalizeProvider(value?: string): AiProviderName {
  const candidate = (value || process.env.AI_PROVIDER || 'openai').toLowerCase();
  if (AI_PROVIDER_NAMES.includes(candidate as AiProviderName)) {
    return candidate as AiProviderName;
  }
  return 'openai';
}

export function getAiSetupGuide() {
  const configured = providerStatus.filter((provider) => provider.enabled);
  return {
    status: configured.length ? 'partial' : 'missing',
    providers: providerStatus,
    message:
      configured.length > 0
        ? 'A provider is configured, but you should validate the selected model and its endpoint settings before live usage.'
        : 'No AI provider credentials were detected. Add OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY to the server environment to enable live model access.'
  };
}

export function validateProviderConfig(providerName?: string) {
  const normalized = normalizeProvider(providerName);
  const keyName = `${normalized.toUpperCase()}_API_KEY`;
  const modelName = `${normalized.toUpperCase()}_MODEL`;
  const apiKey = process.env[keyName];
  const model = process.env[modelName] ||
    (normalized === 'openai' ? 'gpt-4o-mini' : normalized === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gemini-1.5-flash');

  if (!apiKey) {
    return {
      configured: false,
      provider: normalized,
      model,
      apiKey: null,
      reason: `${keyName} is not configured on the server.`
    };
  }

  return {
    configured: true,
    provider: normalized,
    model,
    apiKey,
    reason: null
  };
}

export function buildPlannerReply(message: string) {
  const cleaned = message.trim();
  return {
    status: 'ready',
    message: `I can help with: ${cleaned}.\n\nImplementation plan:\n1. Clarify the target user, scope, and constraints.\n2. Inspect the relevant project files and dependencies.\n3. Create a bounded patch and present a reviewable diff.\n4. Apply the approved change and run the smallest relevant validation.\n5. Summarize verified results, remaining limitations, and next steps.`,
    provider: 'local-planner',
    model: 'devmind-agent'
  };
}

function getProviderEndpoint(provider: AiProviderName) {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages';
    case 'google':
      return 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    default:
      return null;
  }
}

function buildProviderPayload(provider: AiProviderName, message: string) {
  switch (provider) {
    case 'openai':
      return {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: message }],
        temperature: 0.2,
        max_tokens: 800
      };
    case 'anthropic':
      return {
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        messages: [{ role: 'user', content: message }]
      };
    case 'google':
      return {
        contents: [{ parts: [{ text: message }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 800 }
      };
    default:
      throw new Error('Unknown provider');
  }
}

export async function callAiProvider(input: { provider?: string; message: string; stream?: boolean }) {
  const provider = normalizeProvider(input.provider);
  const config = validateProviderConfig(provider);

  if (!config.configured) {
    return {
      status: 'config-required',
      provider,
      model: config.model,
      reply: `The ${provider} provider is selected but its API key is not configured on the server.`,
      setup: getAiSetupGuide(),
      fallback: buildPlannerReply(input.message)
    };
  }

  const endpoint = getProviderEndpoint(provider);
  if (!endpoint) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const payload = buildProviderPayload(provider, input.message);

  if (provider === 'openai') {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  if (provider === 'anthropic') {
    headers['x-api-key'] = config.apiKey!;
    headers['anthropic-version'] = '2023-06-01';
  }
  if (provider === 'google') {
    headers['x-goog-api-key'] = config.apiKey!;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000)
  });

  const text = await response.text();
  if (!response.ok) {
    const messageText = text || 'Unknown provider error';
    return {
      status: 'provider-error',
      provider,
      model: config.model,
      reply: `The ${provider} provider returned an error.`,
      details: messageText,
      fallback: buildPlannerReply(input.message)
    };
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      status: 'provider-error',
      provider,
      model: config.model,
      reply: 'The provider returned a non-JSON response.',
      details: text,
      fallback: buildPlannerReply(input.message)
    };
  }

  const reply =
    provider === 'openai'
      ? data.choices?.[0]?.message?.content || data.error?.message || 'No reply generated.'
      : provider === 'anthropic'
        ? data.content?.[0]?.text || 'No reply generated.'
        : data.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join('') || 'No reply generated.';

  return {
    status: 'ok',
    provider,
    model: config.model,
    reply,
    usage: data.usage || null,
    stream: Boolean(input.stream)
  };
}

export function createToolAuditLog(action: string, details: Record<string, unknown>) {
  return {
    timestamp: new Date().toISOString(),
    action,
    details
  };
}
