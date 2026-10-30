export interface LessonCommit {id: string; parents: string[]; colour: string; title: string | null}
export interface GitFrame {commits: LessonCommit[]; main: string; feature: string | null; head: 'main' | 'feature'; current: string; merge: 'none' | 'commit' | 'fast-forward'}
export function gitStory(advanced: boolean): GitFrame[] {
  const commits: LessonCommit[] = [{id: 'A', parents: [], colour: 'blue', title: null}];
  let main = 'A', feature: string | null = null, head: 'main' | 'feature' = 'main';
  const frames: GitFrame[] = [];
  const frame = (merge: GitFrame['merge'] = 'none') => frames.push({commits: commits.map(c => ({...c, parents: [...c.parents]})), main, feature, head, current: (head === 'main' ? main : feature)!, merge});
  frame();
  feature = 'A'; frame();
  head = 'feature'; commits.push({id: 'B', parents: ['A'], colour: 'green', title: null}); feature = 'B'; frame();
  head = 'main'; frame();
  if (advanced) {commits.push({id: 'C', parents: ['A'], colour: 'blue', title: 'Home'}); main = 'C';}
  frame();
  if (advanced) {commits.push({id: 'M', parents: ['C', 'B'], colour: 'green', title: 'Home'}); main = 'M';}
  else main = 'B';
  frame(advanced ? 'commit' : 'fast-forward');
  return frames;
}
export function currentFiles(frame: GitFrame) {
  const commit = frame.commits.find(c => c.id === frame.current)!;
  return {colour: commit.colour, title: commit.title};
}
