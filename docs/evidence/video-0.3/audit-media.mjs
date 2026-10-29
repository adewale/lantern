// Independently verify the actual encoded files and their HTTP delivery after render-catalog.mjs.
import {ROOT} from '../../../tools/lib/explain-project.ts';
import {EXPLAINERS} from '../../../scenes/explainers/catalog.ts';
import {serve} from '../../../tools/lib/explain-serve.ts';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {probeVideo} from '../../../tools/lib/explain-video.ts';
import {pacingProblems} from '../../../explain/film.ts';
const base=`${ROOT}/out/video-review`;
const rows=JSON.parse(await readFile(`${base}/catalog.json`,'utf8'));
assert.deepEqual(rows.map(x=>x.id),EXPLAINERS.filter(x=>x.video!==false).map(x=>x.id));
const summary=[];let allCues=0,fast=0;
const host=await serve(base,0,'seasons.mp4');
try {
const sec=t=>t.split(':').reduce((n,x)=>n*60+Number(x),0);
for(const r of rows){
 const bytes=await readFile(`${base}/${r.id}.mp4`),receipt=JSON.parse(await readFile(`${base}/${r.id}.mp4.receipt.json`,'utf8'));
 const probe=probeVideo(`${base}/${r.id}.mp4`),video=probe.streams.find(x=>x.codec_type==='video');
 assert.equal(video.codec_name,'h264');assert.equal(video.width,1280);assert.equal(video.height,720);assert.equal(Number(video.nb_frames),receipt.frames);
 assert.equal(probe.streams.filter(x=>x.codec_type==='subtitle'&&x.codec_name==='mov_text').length,1);assert.equal(probe.streams.some(x=>x.codec_type==='audio'),false);
 assert.equal(probe.streams.filter(x=>x.codec_type==='video').length,1);
 const head=await fetch(`${host.url}/${r.id}.mp4`,{method:'HEAD'});
 assert.equal(head.headers.get('content-type'),'video/mp4');
 assert.equal(Number(head.headers.get('content-length')),bytes.length);
 const range=await fetch(`${host.url}/${r.id}.mp4`,{headers:{range:'bytes=0-31'}});
 assert.equal(range.status,206);assert.deepEqual(Buffer.from(await range.arrayBuffer()),bytes.subarray(0,32));
 assert.equal(probe.chapters.length,r.chapters);assert.deepEqual(pacingProblems(receipt.pacing),[]);
 const vtt=await readFile(`${base}/${r.id}.vtt`,'utf8');
 const servedVtt=await fetch(`${host.url}/${r.id}.vtt`);
 assert.equal(servedVtt.headers.get('content-type'),'text/vtt');assert.equal(await servedVtt.text(),vtt);
 const cues=[...vtt.matchAll(/(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})\n([^]*?)(?=\n\n|$)/g)].map(m=>{const duration=sec(m[2])-sec(m[1]),words=m[3].trim().split(/\s+/).length;return {duration,words,wpm:Math.round(words/duration*60)}});
 assert.equal(cues.length,r.captions.length);allCues+=cues.length;fast+=cues.filter(x=>x.wpm>240).length;
 summary.push({id:r.id,sha256:createHash('sha256').update(bytes).digest('hex'),frames:receipt.frames,chapters:r.chapters,pacing:receipt.pacing,maxSubtitleWpm:Math.max(...cues.map(x=>x.wpm)),filmstripSha256:createHash('sha256').update(await readFile(`${base}/${r.id}.film.png`)).digest('hex')});
}
} finally {host.close();}
const result={videos:summary.length,frames:summary.reduce((n,x)=>n+x.frames,0),cues:allCues,cuesOver240Wpm:fast,thresholdIsReviewHeuristic:true,results:summary};
await writeFile(`${ROOT}/docs/evidence/video-0.3/catalog-review.json`,JSON.stringify(result,null,2)+'\n');
console.log({videos:summary.length,frames:result.frames,cues:allCues,fast});
