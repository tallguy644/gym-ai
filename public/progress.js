// Goal progress, workout streaks and the month calendar on the Analytics tab.
// Dates are local "YYYY-MM-DD" strings.

const round1 = (n) => Math.round(n * 10) / 10;

// How far from start weight to goal weight you are, as 0-100.
export function goalProgress(start, latest, goal) {
  if (![start, latest, goal].every(Number.isFinite)) return null;
  const total = Math.abs(goal - start);
  if (total === 0) return { pct: 100, done: 0, total: 0, remaining: round1(Math.abs(goal - latest)) };
  const moved = (latest - start) * Math.sign(goal - start); // negative if going the wrong way
  const done = Math.min(total, Math.max(0, moved));
  return {
    pct: Math.round((done / total) * 100),
    done: round1(done),
    total: round1(total),
    remaining: round1(total - done),
  };
}

const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Monday of the week the date falls in.
export function weekStart(iso) {
  const d = parse(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return fmt(d);
}

// Weeks in a row with at least one workout. This week counts if it has one,
// but an empty current week does not break the streak yet.
export function weekStreak(dates, today) {
  const weeks = new Set(dates.map(weekStart));
  const d = parse(weekStart(today));
  if (!weeks.has(fmt(d))) d.setDate(d.getDate() - 7);
  let streak = 0;
  while (weeks.has(fmt(d))) { streak += 1; d.setDate(d.getDate() - 7); }
  return streak;
}

// Cells for a Monday-first month grid: null for padding, else { date, day, done }.
export function monthCalendar(today, dates) {
  const t = parse(today);
  const first = new Date(t.getFullYear(), t.getMonth(), 1);
  const days = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  const done = new Set(dates);
  const cells = Array((first.getDay() + 6) % 7).fill(null);
  for (let day = 1; day <= days; day++) {
    const date = fmt(new Date(t.getFullYear(), t.getMonth(), day));
    cells.push({ date, day, done: done.has(date), future: date > today });
  }
  return cells;
}
