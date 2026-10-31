export type BirthdayQuestion = 'any' | 'one';
export function birthdayChance(people: number, question: BirthdayQuestion, days = 365): number {
  if (!Number.isInteger(people) || people < 1 || people > 1000 || !Number.isInteger(days) || days < 1 || days > 1000)
    throw new Error('People and days must be integers from 1 to 1000');
  if (question !== 'any' && question !== 'one') throw new Error('Unknown birthday question');
  if (question === 'one') return 1 - ((days - 1) / days) ** (people - 1);
  if (people > days) return 1;
  let none = 1;
  for (let i = 0; i < people; i++) none *= (days - i) / days;
  return 1 - none;
}
export function matches(group: readonly number[], question: BirthdayQuestion): boolean {
  return question === 'any' ? new Set(group).size !== group.length : group.slice(1).includes(group[0]!);
}
// Park–Miller generator. Rejection sampling avoids a modulo bias in calendar days.
export function birthdaySample(people: number, question: BirthdayQuestion, trials = 1000, seed = 137) {
  birthdayChance(people, question);
  if (!Number.isInteger(trials) || trials < 1 || trials > 10000 || !Number.isInteger(seed) || seed < 1 || seed >= 2147483647)
    throw new Error('Invalid birthday sample size or seed');
  let value = seed;
  const nextDay = () => {
    let u: number;
    const limit = Math.floor(2147483646 / 365) * 365;
    do {value = value * 16807 % 2147483647; u = value - 1;} while (u >= limit);
    return u % 365 + 1;
  };
  let matched = 0;
  let first: number[] = [];
  for (let t = 0; t < trials; t++) {
    const group = Array.from({length: people}, nextDay);
    if (t === 0) first = group;
    if (matches(group, question)) matched++;
  }
  return {seed, trials, matched, first, observed: matched / trials};
}
export function birthdayStory(people: number, question: BirthdayQuestion) {
  const chance = birthdayChance(people, question), comparisons = question === 'any' ? people * (people - 1) / 2 : people - 1;
  return {people, question, chance, comparisons, noMatch: 1 - chance,
    factors: [2, 3, people].map(person => ({person, numerator: question === 'any' ? 365 - (person - 1) : 364, denominator: 365})),
    any: birthdayChance(people, 'any'), one: birthdayChance(people, 'one'), sample: birthdaySample(people, question)};
}
