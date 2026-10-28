// Turns a submitted form into the plan response. Shared by the web server and
// the Android app, so both behave the same way.
import { analyzeGoal, starterPlan, validateProfile } from './domain.mjs';

export const NO_AI_NOTICE = 'AI is not set up on this server yet, so here is a starter plan.';
export const AI_FAILED_NOTICE = 'The AI coach is unavailable right now, so here is a starter plan.';

// Returns { status, body }. generatePlan is optional; without it you get a starter plan.
export async function planResponse(input, { generatePlan, log = console, noAiNotice = NO_AI_NOTICE } = {}) {
  const result = validateProfile(input);
  if (!result.ok) return { status: 400, body: { errors: result.errors } };

  const analysis = analyzeGoal(result.profile);
  if (generatePlan) {
    try {
      const plan = await generatePlan(result.profile);
      return { status: 200, body: { source: 'ai', analysis, plan } };
    } catch (err) {
      log.error('AI plan failed, using starter plan:', err?.message ?? err);
      return { status: 200, body: { source: 'starter', notice: AI_FAILED_NOTICE, analysis, plan: starterPlan(result.profile) } };
    }
  }
  return { status: 200, body: { source: 'starter', notice: noAiNotice, analysis, plan: starterPlan(result.profile) } };
}
