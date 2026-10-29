// Reproduce actual default-case media and filmstrips for every video-enabled catalog entry.
// Run from the repository on Node 24 with FFmpeg, Chromium and requested fonts installed.
import { collectProject, defaultVariant, ROOT } from '../../../tools/lib/explain-project.ts';
import { renderVideo, probeVideo } from '../../../tools/lib/explain-video.ts';
import { filmstrip } from '../../../tools/lib/explain-shots.ts';
import { filmPlan, words } from '../../../explain/film.ts';
import { stepWords } from '../../../explain/trace.ts';
import { EXPLAINERS } from '../../../scenes/explainers/catalog.ts';
import { writeFile, mkdir } from 'node:fs/promises';
const root=`${ROOT}/out/video-review`;
await mkdir(root,{recursive:true});
const report=[];
for(const item of EXPLAINERS.filter(x=>x.video!==false)) {
 const p=await collectProject(`${ROOT}/scenes/explainers/${item.id}`,{write:false});
 const v=defaultVariant(p);
 const film=filmPlan(v.trace);
 const captions=film.map((s,i)=>({step:s.step,seconds:s.t1-s.t0,words:words(stepWords(v.trace.steps[i]).caption),wpm:Math.round(words(stepWords(v.trace.steps[i]).caption)/(s.t1-s.t0)*60)}));
 const receipt=await renderVideo(p,v,`${root}/${item.id}.mp4`);
 const probe=probeVideo(`${root}/${item.id}.mp4`);
 await filmstrip(p,`${root}/${item.id}.film.png`,v,1);
 report.push({id:item.id,captions,pacing:receipt.pacing,frames:receipt.frames,streams:probe.streams.map(x=>({type:x.codec_type,codec:x.codec_name})),chapters:probe.chapters.length});
 await writeFile(`${root}/catalog.json`,JSON.stringify(report,null,2)+'\n');
 console.log(`${item.id}: video decoded; filmstrip generated; max subtitle WPM ${Math.max(...captions.map(x=>x.wpm))}`);
}
