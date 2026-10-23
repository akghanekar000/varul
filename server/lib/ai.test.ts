import { describe, expect, it } from 'vitest';
import { buildPlannerReply, getAiSetupGuide } from '../server/lib/ai';

describe('AI configuration boundary', () => {
  it('returns a setup guide when no provider keys are configured', () => {
    const guide = getAiSetupGuide();

    expect(guide.status).toBe('missing');
    expect(guide.providers.some((provider) => provider.enabled)).toBe(false);
  });

  it('builds a bounded implementation plan', () => {
    const response = buildPlannerReply('Create an auth dashboard for a SaaS product');

    expect(response.status).toBe('ready');
    expect(response.provider).toBe('local-planner');
    expect(response.message).toContain('Implementation plan');
  });
});
