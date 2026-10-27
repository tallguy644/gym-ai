// Builds a link to demo videos for an exercise. The AI can name any exercise,
// so we search YouTube for a form tutorial instead of relying on a fixed list
// of video IDs that could go stale.
export function cleanExerciseName(name) {
  return String(name ?? '')
    .replace(/\([^)]*\)/g, ' ') // drop asides like "(incline if needed)"
    .replace(/\s+/g, ' ')
    .trim();
}

export function videoUrl(name) {
  const clean = cleanExerciseName(name);
  if (!clean) return '';
  const query = `how to do ${clean} proper form`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
