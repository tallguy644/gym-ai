import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanExerciseName, videoUrl } from '../public/video.js';
import { starterPlan } from '../domain.mjs';

test('builds a YouTube search link for an exercise', () => {
  const url = new URL(videoUrl('Barbell back squat'));
  assert.equal(url.hostname, 'www.youtube.com');
  assert.equal(url.searchParams.get('search_query'), 'how to do Barbell back squat proper form');
});

test('drops asides in brackets and safely encodes odd names', () => {
  assert.equal(cleanExerciseName('Push-up (incline if needed)'), 'Push-up');
  const url = videoUrl('Cable "fly" & <press>');
  assert.ok(!/[<>"& ]/.test(url.split('?')[1]));
});

test('returns no link for an empty name', () => {
  assert.equal(videoUrl(''), '');
  assert.equal(videoUrl(undefined), '');
});

test('every starter-plan exercise gets a video link', () => {
  for (const equipment of ['full_gym', 'dumbbells', 'bodyweight']) {
    const plan = starterPlan({ currentWeight: 200, goalWeight: 180, unit: 'lb', experience: 'beginner', daysPerWeek: 3, sessionMinutes: 45, equipment, sex: 'unspecified' });
    for (const day of plan.weeklySchedule) for (const e of day.exercises) assert.ok(videoUrl(e.name));
  }
});
