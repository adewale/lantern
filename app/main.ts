import { mountPlayer, sceneNames } from './player.ts';
import { mountGuide } from './guide.ts';
// index.html has both: the player's <main> and the guide's section
mountPlayer(document.querySelector('main')!);
mountGuide(document.getElementById('guide'), sceneNames());
