// Daily readiness from a quick check-in. The app has no wearable data (sleep
// tracking, HRV), so the person rates four things from 1 to 5 instead.

export const FACTORS = [
  { key: 'sleep', label: 'Sleep', words: ['Poor', 'Fair', 'OK', 'Good', 'Excellent'], higherIsBetter: true, weight: 0.35 },
  { key: 'energy', label: 'Energy', words: ['Very low', 'Low', 'Okay', 'High', 'Very high'], higherIsBetter: true, weight: 0.25 },
  { key: 'soreness', label: 'Soreness', words: ['None', 'Light', 'Some', 'Sore', 'Very sore'], higherIsBetter: false, weight: 0.25 },
  { key: 'stress', label: 'Stress', words: ['Very low', 'Low', 'Moderate', 'High', 'Very high'], higherIsBetter: false, weight: 0.15 },
];

const clamp = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 3;
};

// 0-100, where 100 means "good" for that factor (low soreness counts as good).
export function factorPercent(factor, value) {
  const v = clamp(value);
  return Math.round(((factor.higherIsBetter ? v - 1 : 5 - v) / 4) * 100);
}

export function factorWord(factor, value) {
  return factor.words[clamp(value) - 1];
}

export function readinessScore(checkin = {}) {
  const total = FACTORS.reduce((sum, f) => sum + f.weight * factorPercent(f, checkin[f.key]), 0);
  return Math.round(total);
}

export function readinessLabel(score) {
  if (score >= 80) return 'Optimal';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Moderate';
  return 'Low';
}

// One short coaching line for today, based on the check-in.
export function readinessAdvice(checkin = {}) {
  const score = readinessScore(checkin);
  const lines = [];
  if (score >= 80) lines.push('Readiness is optimal for a heavy session. Push toward the top of your rep ranges.');
  else if (score >= 60) lines.push('You are good to train as planned.');
  else if (score >= 40) lines.push('Train, but drop one set per exercise and stop 2-3 reps short of failure.');
  else lines.push('Take it easy today: a light session, mobility work or a walk.');

  if (clamp(checkin.soreness) >= 4) lines.push('Soreness is high, so lower the volume on the muscles that feel it most.');
  if (clamp(checkin.sleep) <= 2) lines.push('Short on sleep: take a longer warm-up and skip max efforts.');
  if (clamp(checkin.stress) >= 4 && score >= 40) lines.push('Stress is high, so keep rest periods generous.');
  return lines.join(' ');
}
