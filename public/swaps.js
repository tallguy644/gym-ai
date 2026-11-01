// Alternatives for "Swap Exercise". An exercise is matched to a movement group
// by keywords (AI plans can name anything), then we offer other moves from that
// group that the person's equipment allows.

const G = 'full_gym';
const D = 'dumbbells';
const B = 'bodyweight';

// Order matters: the first group whose pattern matches wins. Within a group,
// machines and cables come first so a full gym is offered those first.
const GROUPS = [
  { match: /leg extension|leg curl|hamstring curl|calf/, options: [['Leg extension', G], ['Lying leg curl', G], ['Seated leg curl', G], ['Standing calf raise', B], ['Nordic hamstring curl', B]] },
  { match: /lunge|split squat|step-up|step up/, options: [['Leg extension', G], ['Smith machine split squat', G], ['Walking lunge', B], ['Dumbbell reverse lunge', D], ['Bulgarian split squat', B], ['Split squat', B], ['Step-up', B], ['Barbell reverse lunge', G]] },
  { match: /deadlift|rdl|hinge|good morning|hip thrust|glute bridge|swing|back extension/, options: [['Seated leg curl', G], ['Machine hip thrust', G], ['Back extension', G], ['Romanian deadlift', G], ['Dumbbell Romanian deadlift', D], ['Single-leg hip hinge', B], ['Glute bridge', B]] },
  { match: /squat|leg press|wall sit/, options: [['Leg press', G], ['Hack squat', G], ['Smith machine squat', G], ['Barbell back squat', G], ['Goblet squat', D], ['Bodyweight squat', B], ['Wall sit', B], ['Box squat', B]] },
  { match: /shoulder press|overhead|military|pike|arnold|standing dumbbell press|lateral raise|handstand/, options: [['Machine shoulder press', G], ['Cable lateral raise', G], ['Barbell overhead press', G], ['Seated dumbbell shoulder press', D], ['Standing dumbbell press', D], ['Arnold press', D], ['Pike push-up', B], ['Wall handstand hold', B]] },
  { match: /pulldown|pull-up|pullup|chin/, options: [['Lat pulldown', G], ['Assisted pull-up', G], ['Pull-up', G], ['Chin-up', G], ['Dumbbell pullover', D], ['Towel or table row', B]] },
  { match: /row|snow angel|face pull/, options: [['Seated cable row', G], ['Machine row', G], ['Face pull', G], ['Barbell row', G], ['One-arm dumbbell row', D], ['Chest-supported dumbbell row', D], ['Towel or table row', B], ['Reverse snow angel', B]] },
  { match: /bench|push-up|pushup|press-up|floor press|chest press|incline machine press|pec deck|dip|fly|flye/, options: [['Machine chest press', G], ['Incline machine press', G], ['Pec deck', G], ['Cable fly', G], ['Barbell bench press', G], ['Dumbbell floor press', D], ['Push-up', B], ['Incline push-up', B]] },
  { match: /crunch|plank|dead bug|\bab\b|\babs\b|core|leg raise|knee raise|twist|pallof|hollow/, options: [['Cable crunch', G], ['Hanging knee raise', G], ['Pallof press', G], ['Dead bug', B], ['Plank', B], ['Side plank', B], ['Hollow hold', B]] },
  { match: /tricep|pushdown|skull|extension/, options: [['Cable pushdown', G], ['Overhead dumbbell extension', D], ['Bench dip', B], ['Close-grip push-up', B]] },
  { match: /curl/, options: [['Cable curl', G], ['Barbell curl', G], ['Dumbbell curl', D], ['Hammer curl', D]] },
  { match: /treadmill|walk|jog|run|bike|cycle|rower|elliptical|stair|cardio/, options: [['Incline treadmill walk', G], ['Stationary bike', G], ['Rowing machine', G], ['Elliptical', G], ['Brisk walk or jog', B], ['Jump rope', B]] },
];

// What each equipment setting can use.
const ALLOWED = { full_gym: [G, D, B], dumbbells: [D, B], bodyweight: [B] };

export function swapOptions(name, equipment = 'full_gym') {
  const lower = String(name ?? '').toLowerCase();
  if (!lower.trim()) return [];
  const group = GROUPS.find((g) => g.match.test(lower));
  if (!group) return [];
  const allowed = ALLOWED[equipment] ?? ALLOWED.full_gym;
  return group.options
    .filter(([option, needs]) => allowed.includes(needs) && option.toLowerCase() !== lower)
    .map(([option]) => option);
}

// Returns a new exercise with the same sets, reps and rest.
export function swapExercise(exercise, newName) {
  return { ...exercise, name: newName, notes: '', swappedFrom: exercise.swappedFrom ?? exercise.name };
}
