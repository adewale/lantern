export type Host = 'informed' | 'random';
// Fix the first choice at door 0. An informed host leaves the prize available;
// a random host picks the other closed door without knowing the prize location.
// For the informed host's tied case, each other door is equally likely to remain.
export function monty(doors: number, host: Host) {
  if (!Number.isInteger(doors) || doors < 3 || doors > 100) throw new Error('Use 3 to 100 doors');
  if (!['informed', 'random'].includes(host)) throw new Error('Unknown host rule');
  const stay = doors - 1, swap = host === 'informed' ? (doors - 1) ** 2 : doors - 1;
  const total = doors * (doors - 1), discarded = total - stay - swap;
  return {doors, host, stay, swap, discarded, total, continuing: stay + swap,
    stayChance: stay / (stay + swap), switchChance: swap / (stay + swap),
    continuationChance: (stay + swap) / total, opened: doors - 2};
}
export function threeDoorWorlds(choice: number, host: Host) {
  if (![0,1,2].includes(choice)) throw new Error('Choose door A, B or C');
  const name=(i:number)=>'ABC'[i]!;
  return [0,1,2].flatMap(prize=>{
    const possible=[0,1,2].filter(i=>i!==choice);
    if(host==='informed') return [{prize:name(prize),opened:possible.filter(i=>i!==prize).map(name).join(' or '),
      stay:prize===choice?'win':'lose',swap:prize===choice?'lose':'win'}];
    return possible.map(opened=>({prize:name(prize),opened:`${name(opened)}: ${opened===prize?'car':'goat'}`,
      stay:opened===prize?'ends':prize===choice?'win':'lose',swap:opened===prize?'ends':prize===choice?'lose':'win'}));
  });
}
export function montyExample(choice: number, strategy: 'stay'|'switch') {
  if (![0,1,2].includes(choice) || !['stay','switch'].includes(strategy)) throw new Error('Invalid Monty Hall choice');
  const prize=2, opened=[0,1,2].find(i=>i!==choice&&i!==prize)!;
  const offered=[0,1,2].find(i=>i!==choice&&i!==opened)!;
  const final=strategy==='stay'?choice:offered;
  return {choice,prize,opened,offered,final,won:final===prize,strategy};
}
