import { z } from 'zod';

export const aiChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  projectId: z.string().optional()
});

export const providerStatus = [
  { name: 'openai', key: 'OPENAI_API_KEY', enabled: Boolean(process.env.OPENAI_API_KEY) },
  { name: 'anthropic', key: 'ANTHROPIC_API_KEY', enabled: Boolean(process.env.ANTHROPIC_API_KEY) },
  { name: 'google', key: 'GOOGLE_API_KEY', enabled: Boolean(process.env.GOOGLE_API_KEY) }
];

export function getAiSetupGuide() {
  const configured = providerStatus.filter((provider) => provider.enabled);

  return {
    status: configured.length ? 'partial' : 'missing',
    providers: providerStatus,
    message:
      configured.length > 0
        ? 'AI provider credentials are partially configured. Review the env values and restart the server.'
        : 'No AI provider credentials were detected. Add OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY in the server environment to enable live model access.'
  };
}

export function buildPlannerReply(message: string) {
  const cleaned = message.trim();

  return {
    status: 'ready',
    message: `I can help with: ${cleaned}.\n\nImplementation plan:\n1. Clarify the target user, scope, and constraints.\n2. Map the required files and architecture.\n3. Draft the patch, review risk, and validate with the smallest relevant checks.\n4. Summarize the results, remaining trade-offs, and follow-up tasks.`,
    provider: 'local-planner',
    model: 'devmind-agent'
  };
}
