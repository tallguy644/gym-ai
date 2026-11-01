// Pure logic: input validation, goal math and a rule-based starter plan.
// No network calls here, so it is easy to test.

export const EQUIPMENT = ['full_gym', 'dumbbells', 'bodyweight'];
export const EXPERIENCE = ['beginner', 'intermediate', 'advanced'];
export const SEX = ['male', 'female', 'unspecified'];

const LB_PER_KG = 2.20462;

function num(value) {
  const n = typeof value === 'string' ? Number(value.trim()) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : NaN;
}

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

// Returns { ok: true, profile } or { ok: false, errors: [...] }.
export function validateProfile(body = {}) {
  const errors = [];
  const unit = body.unit === 'kg' ? 'kg' : 'lb';
  const currentWeight = num(body.currentWeight);
  const goalWeight = num(body.goalWeight);
  const [min, max] = unit === 'kg' ? [30, 300] : [66, 660];

  if (!(currentWeight >= min && currentWeight <= max)) errors.push(`Current weight must be between ${min} and ${max} ${unit}.`);
  if (!(goalWeight >= min && goalWeight <= max)) errors.push(`Goal weight must be between ${min} and ${max} ${unit}.`);

  const age = body.age === undefined || body.age === '' ? null : num(body.age);
  if (age !== null && !(age >= 13 && age <= 100)) errors.push('Age must be between 13 and 100.');

  const daysPerWeek = num(body.daysPerWeek ?? 3);
  if (!(Number.isInteger(daysPerWeek) && daysPerWeek >= 2 && daysPerWeek <= 6)) errors.push('Days per week must be 2 to 6.');

  const minutes = num(body.sessionMinutes ?? 45);
  if (!(minutes >= 20 && minutes <= 120)) errors.push('Session length must be 20 to 120 minutes.');

  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : '';

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    profile: {
      unit,
      currentWeight,
      goalWeight,
      age,
      sex: pick(body.sex, SEX, 'unspecified'),
      experience: pick(body.experience, EXPERIENCE, 'beginner'),
      equipment: pick(body.equipment, EQUIPMENT, 'full_gym'),
      daysPerWeek,
      sessionMinutes: Math.round(minutes),
      notes,
    },
  };
}

// Works out the direction, size and a safe timeline for the goal.
export function analyzeGoal({ currentWeight, goalWeight, unit }) {
  const diff = goalWeight - currentWeight;
  const toKg = (w) => (unit === 'kg' ? w : w / LB_PER_KG);
  const fromKg = (w) => (unit === 'kg' ? w : w * LB_PER_KG);
  const round1 = (n) => Math.round(n * 10) / 10;

  // Within 1% of body weight counts as "maintain / recomposition".
  if (Math.abs(diff) <= currentWeight * 0.01) {
    return { goal: 'recomp', change: round1(diff), weeklyRate: 0, estimatedWeeks: 12, unit };
  }
  if (diff < 0) {
    // Lose about 0.75% of body weight per week, capped at 1 kg/week.
    const rateKg = Math.min(toKg(currentWeight) * 0.0075, 1);
    return {
      goal: 'lose',
      change: round1(diff),
      weeklyRate: round1(fromKg(rateKg)),
      estimatedWeeks: Math.ceil(toKg(-diff) / rateKg),
      unit,
    };
  }
  // Lean gain: about 0.25% of body weight per week.
  const rateKg = toKg(currentWeight) * 0.0025;
  return {
    goal: 'gain',
    change: round1(diff),
    weeklyRate: round1(fromKg(rateKg)),
    estimatedWeeks: Math.ceil(toKg(diff) / rateKg),
    unit,
  };
}

const LIBRARY = {
  // Full gym plans use machines and cables first: they are easier to learn and
  // safer to push hard without a spotter.
  full_gym: {
    squat: 'Leg press', hinge: 'Seated leg curl', push: 'Machine chest press', pull: 'Lat pulldown',
    ohp: 'Machine shoulder press', row: 'Seated cable row', lunge: 'Leg extension', core: 'Cable crunch',
    cardio: 'Incline treadmill walk',
  },
  dumbbells: {
    squat: 'Goblet squat', hinge: 'Dumbbell Romanian deadlift', push: 'Dumbbell floor press', pull: 'One-arm dumbbell row',
    ohp: 'Standing dumbbell press', row: 'Chest-supported dumbbell row', lunge: 'Dumbbell reverse lunge', core: 'Dead bug',
    cardio: 'Brisk walk or jog',
  },
  bodyweight: {
    squat: 'Bodyweight squat', hinge: 'Single-leg hip hinge', push: 'Push-up (incline if needed)', pull: 'Towel or table row',
    ohp: 'Pike push-up', row: 'Reverse snow angel', lunge: 'Split squat', core: 'Plank',
    cardio: 'Brisk walk or jog',
  },
};

// A sensible plan built from rules, used when no AI key is set or the AI call fails.
export function starterPlan(profile) {
  const analysis = analyzeGoal(profile);
  const lib = LIBRARY[profile.equipment];
  const reps = analysis.goal === 'gain' ? '6-10' : '8-12';
  const sets = profile.experience === 'beginner' ? 3 : 4;
  const ex = (key, extra = {}) => ({ name: lib[key], sets, reps, restSeconds: 90, notes: '', ...extra });

  const dayA = { focus: 'Full body A', exercises: [ex('squat'), ex('push'), ex('row'), ex('core', { reps: '30-45 sec' })] };
  const dayB = { focus: 'Full body B', exercises: [ex('hinge'), ex('ohp'), ex('pull'), ex('lunge', profile.equipment === 'full_gym' ? { reps: '10-15' } : { reps: '10 each leg' })] };
  const cardioMinutes = analysis.goal === 'lose' ? 20 : analysis.goal === 'recomp' ? 10 : 0;

  const days = Array.from({ length: profile.daysPerWeek }, (_, i) => {
    const base = i % 2 === 0 ? dayA : dayB;
    return {
      day: `Day ${i + 1}`,
      focus: base.focus,
      warmup: '5 minutes easy cardio, then 1-2 light sets of the first exercise.',
      exercises: base.exercises,
      cardio: cardioMinutes ? `${lib.cardio}, ${cardioMinutes} minutes at a pace where you can still talk.` : 'None today. Save energy for lifting.',
    };
  });

  const goalText = {
    lose: `lose ${Math.abs(analysis.change)} ${profile.unit}`,
    gain: `gain ${analysis.change} ${profile.unit}`,
    recomp: 'hold your weight while building strength',
  }[analysis.goal];

  return {
    title: `${profile.daysPerWeek}-day ${analysis.goal === 'gain' ? 'muscle gain' : analysis.goal === 'lose' ? 'fat loss' : 'recomposition'} plan`,
    summary: `A full-body plan to help you ${goalText}. Train ${profile.daysPerWeek} days a week for about ${profile.sessionMinutes} minutes.`,
    weeklySchedule: days,
    progression: 'When you hit the top of the rep range on every set, add a little weight next session (2.5-5 lb / 1-2 kg).',
    nutrition: [
      analysis.goal === 'lose' ? 'Eat in a small calorie deficit (about 300-500 kcal under maintenance).' :
        analysis.goal === 'gain' ? 'Eat in a small calorie surplus (about 200-300 kcal over maintenance).' :
          'Eat around maintenance calories.',
      'Aim for roughly 0.7-1 g of protein per lb of goal body weight (1.6-2.2 g per kg).',
      'Drink water through the day and sleep 7-9 hours.',
    ],
    safety: ['Stop any exercise that causes sharp pain.', 'Check with a doctor before starting if you have a health condition.'],
  };
}
