// Generates a workout plan with Claude. The response is forced into PLAN_SCHEMA
// with structured outputs, so the page always gets the same JSON shape.
import Anthropic from '@anthropic-ai/sdk';
import { analyzeGoal } from './domain.mjs';

export const DEFAULT_MODEL = 'claude-opus-5-5';

const exercise = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'sets', 'reps', 'restSeconds', 'notes'],
  properties: {
    name: { type: 'string' },
    sets: { type: 'integer' },
    reps: { type: 'string', description: 'Rep range or time, e.g. "8-12" or "30 sec"' },
    restSeconds: { type: 'integer' },
    notes: { type: 'string', description: 'Short form cue, or empty string' },
  },
};

export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'weeklySchedule', 'progression', 'nutrition', 'safety'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    weeklySchedule: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['day', 'focus', 'warmup', 'exercises', 'cardio'],
        properties: {
          day: { type: 'string' },
          focus: { type: 'string' },
          warmup: { type: 'string' },
          exercises: { type: 'array', items: exercise },
          cardio: { type: 'string' },
        },
      },
    },
    progression: { type: 'string' },
    nutrition: { type: 'array', items: { type: 'string' } },
    safety: { type: 'array', items: { type: 'string' } },
  },
};

const SYSTEM = `You are an experienced strength coach. You write gym workout plans that are safe, simple to follow and matched to the person's goal.
Rules:
- Build exactly one entry in weeklySchedule per training day the person asked for.
- Fit each session, warm-up included, into their session length.
- Only use exercises their equipment allows.
- With full gym access, build the plan mainly from machines and cables (leg press, chest press, lat pulldown, cable row, machine shoulder press, leg curl and similar). Use free weights only where no good machine option exists.
- Weight loss: keep heavy compound lifting to protect muscle, and add moderate cardio. Weight gain: prioritise progressive overload and keep cardio light. Recomposition: balance both.
- Respect any injuries or notes. If a note suggests a medical risk, say to check with a doctor in safety.
- Use plain language. Keep notes and cues short.`;

export function buildPrompt(profile) {
  const a = analyzeGoal(profile);
  const lines = [
    `Current weight: ${profile.currentWeight} ${profile.unit}`,
    `Goal weight: ${profile.goalWeight} ${profile.unit}`,
    `Goal: ${a.goal} (${a.change > 0 ? '+' : ''}${a.change} ${profile.unit}); safe pace about ${a.weeklyRate} ${profile.unit}/week, roughly ${a.estimatedWeeks} weeks`,
    `Experience: ${profile.experience}`,
    `Equipment: ${profile.equipment.replace('_', ' ')}`,
    `Training days per week: ${profile.daysPerWeek}`,
    `Session length: ${profile.sessionMinutes} minutes`,
  ];
  if (profile.age) lines.push(`Age: ${profile.age}`);
  if (profile.sex !== 'unspecified') lines.push(`Sex: ${profile.sex}`);
  if (profile.notes) lines.push(`Notes from the person (injuries, preferences): ${profile.notes}`);
  return `Write a weekly gym workout plan for this person.\n\n${lines.join('\n')}`;
}

export function createPlanGenerator({ client, model = process.env.CLAUDE_MODEL || DEFAULT_MODEL } = {}) {
  const anthropic = client ?? new Anthropic();

  return async function generatePlan(profile) {
    // Beta endpoint so a refused request falls back to another model automatically.
    const response = await anthropic.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: PLAN_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: buildPrompt(profile) }],
    });

    if (response.stop_reason === 'refusal') throw new Error('The AI declined to write this plan.');
    if (response.stop_reason === 'max_tokens') throw new Error('The AI plan was cut off.');
    const text = response.content.find((b) => b.type === 'text')?.text;
    if (!text) throw new Error('The AI returned no plan.');
    return JSON.parse(text);
  };
}
