import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Browser,Page} from 'playwright-core';
import {launch} from '../tools/lib/browser.ts';
import {collectProject} from '../tools/lib/explain-project.ts';
import {buildExplainer} from '../tools/lib/explain-build.ts';
import {serve} from '../tools/lib/explain-serve.ts';
const enabled=!!process.env.EXPLAIN_BROWSER;
const options={skip:enabled?false:'set EXPLAIN_BROWSER=1 for real Web Audio and score checks'};
let browser:Browser,folder:string,server:Awaited<ReturnType<typeof serve>>;
before(async()=>{
  if(!enabled)return;
  folder=await mkdtemp(join(tmpdir(),'rayner-audio-'));
  for(const id of ['melody-rhythm','hello-world']) await buildExplainer(await collectProject(`scenes/explainers/${id}`,{write:false}),join(folder,id+'.html'));
  server=await serve(folder,0,'melody-rhythm.html');browser=await launch();
});
after(async()=>{if(!enabled)return;await browser?.close();server?.close();if(folder)await rm(folder,{recursive:true,force:true});});
// Observe the real browser graph and clock. Native oscillators still connect to
// the destination and run; the wrapper records scheduling without replacing DSP.
async function observed(page:Page) {
  await page.addInitScript(()=>{
    const w=window as any,Native=AudioContext;
    w.scoreProbe={contexts:0,tones:[],late:false,release:null};
    w.AudioContext=class extends Native {
      constructor(){super();w.scoreProbe.contexts++;w.scoreProbe.context=this;}
      override resume(){
        if(w.scoreProbe.late) return new Promise<void>(resolve=>{w.scoreProbe.release=()=>{super.resume().then(resolve);};});
        return super.resume();
      }
      override createOscillator(){
        const osc=super.createOscillator(),entry:any={stops:[]};w.scoreProbe.tones.push(entry);
        const start=osc.start.bind(osc),stop=osc.stop.bind(osc),frequency=osc.frequency.setValueAtTime.bind(osc.frequency);
        osc.frequency.setValueAtTime=(value,when)=>{entry.frequency=value;return frequency(value,when);};
        osc.start=(when=0)=>{entry.start=when;start(when);};
        osc.stop=(when=0)=>{entry.stops.push(when);stop(when);};
        return osc;
      }
    };
  });
}
async function ready(page:Page,step='listen') {
  await page.waitForSelector('[data-ready=true]');
  await page.waitForFunction(name=>document.querySelector('[aria-current=step]')?.getAttribute('data-step')===name&&!document.querySelector('#content.loading'),step);
}

test('audio is opt-in, offline, gesture-triggered and follows the score at both tempos',options,async()=>{
  const plain=await readFile(join(folder,'hello-world.html'),'utf8');
  assert.ok(!plain.includes('score-audio')&&!plain.includes('createOscillator'),'a plain page carries no optional sound UI or DSP');
  for(const bpm of [96,120]) for(const timing of ['syncopated','straight']) {
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const errors:string[]=[],external:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==server.url){external.push(route.request().url());return route.abort();}return route.continue();});
    try {
      await observed(page);const response=await page.goto(`${server.url}/melody-rhythm.html?tempo=${bpm}&timing=${timing}`);await ready(page);
      assert.match(response!.headers()['content-security-policy']!,/connect-src 'none'/);
      assert.equal(await page.evaluate(()=>(window as any).scoreProbe.contexts),0,'no context or autoplay before a gesture');
      assert.equal(await page.locator('.score-audio').isVisible(),true);
      const placement=await page.evaluate(()=>{const b=(s:string)=>document.querySelector(s)!.getBoundingClientRect();return {picture:b('.stage').bottom,caption:b('.caption'),audio:b('.score-audio').top};});
      assert.ok(placement.caption.top>=placement.picture&&placement.audio>=placement.caption.bottom,'caption stays beside its picture, then audio controls');
      await page.getByRole('checkbox',{name:'Pulse'}).uncheck();
      await page.getByRole('button',{name:timing==='syncopated'?'Play B: shifted timing':'Play B: even beats',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.score-audio')?.getAttribute('data-playing')==='true');
      const scheduled=await page.evaluate(()=>(window as any).scoreProbe.tones);
      assert.equal(scheduled.length,8);
      const starts=timing==='syncopated'?[0,1,2,3.5,4.5,5,6,7]:[0,1,2,3,4,5,6,7];
      const lengths=timing==='syncopated'?[1,1,1.5,1,.5,1,1,1]:Array(8).fill(1);
      for(let i=0;i<8;i++) {
        assert.ok(Math.abs((scheduled[i].start-scheduled[0].start)/(60/bpm)-starts[i]!)<1e-8);
        assert.ok(Math.abs((scheduled[i].stops[0]-scheduled[i].start)/(60/bpm)-lengths[i]!)<1e-8);
        const hz=440*2**(([60,62,64,67,64,62,60,60][i]!-69)/12);
        assert.ok(Math.abs(scheduled[i].frequency-hz)<.001);
      }
      await page.waitForFunction(()=>Number(document.querySelector('.score-playhead')?.getAttribute('x1'))>-5900);
      const clock=await page.evaluate(()=>{const p=(window as any).scoreProbe;return {now:p.context.currentTime,start:p.tones[0].start,x:Number(document.querySelector('.score-playhead')!.getAttribute('x1'))};});
      const expected=-6000+13200*Math.max(0,clock.now-clock.start)/(8*60/bpm);
      assert.ok(Math.abs(clock.x-expected)<250,'native audio clock and painted cursor agree within one slow browser frame');
      await page.getByRole('button',{name:'Stop',exact:true}).click();
      assert.equal(await page.locator('.score-playhead').count(),0);
      assert.equal(await page.evaluate(()=>(window as any).scoreProbe.tones.every((t:any)=>t.stops.at(-1)===0)),true,'Stop cancels every scheduled note');
      await page.getByRole('checkbox',{name:'Pulse'}).check();
      await page.getByRole('button',{name:'Play A: even beats',exact:true}).click();
      await page.waitForFunction(()=>(window as any).scoreProbe.tones.length===24);
      const pulses=await page.evaluate(()=>(window as any).scoreProbe.tones.slice(16));
      assert.equal(pulses.length,8);assert.notEqual(pulses[0].frequency,pulses[1].frequency,'bar downbeats have a distinct pulse');
      await page.locator('.step-transport button[aria-label="Next step"]').click();await ready(page,'pulse');
      assert.equal(await page.locator('.score-playhead').count(),0);assert.equal(await page.locator('.score-audio').getAttribute('data-playing'),'false');
      assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    } finally {await page.close();}
  }
});

test('navigation cancels a pending audio resume, and flattened pitches really play C',options,async()=>{
  const page=await browser.newPage({reducedMotion:'reduce'});
  try {
    await observed(page);await page.goto(server.url+'/melody-rhythm.html');await ready(page);
    await page.evaluate(()=>(window as any).scoreProbe.late=true);
    await page.getByRole('button',{name:'Play A: even beats',exact:true}).click();
    await page.getByRole('button',{name:'Stop',exact:true}).click();
    await page.evaluate(()=>{const p=(window as any).scoreProbe;p.release();});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    assert.equal(await page.evaluate(()=>(window as any).scoreProbe.tones.length),0,'Stop cancels a pending resume');
    await page.getByRole('button',{name:'Play A: even beats',exact:true}).click();
    await page.locator('.step-transport button[aria-label="Next step"]').click();await ready(page,'pulse');
    await page.evaluate(()=>{const p=(window as any).scoreProbe;p.release();p.late=false;});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    assert.equal(await page.evaluate(()=>(window as any).scoreProbe.tones.length),0,'late resume cannot start an obsolete score');
    await page.locator('.step-transport button[aria-label="Next step"]').click();await ready(page,'rhythm');
    await page.getByRole('checkbox',{name:'Pulse'}).uncheck();
    await page.getByRole('button',{name:'Play B: shifted timing',exact:true}).click();
    await page.waitForFunction(()=>(window as any).scoreProbe.tones.length===8);
    const frequencies=await page.evaluate(()=>(window as any).scoreProbe.tones.map((t:any)=>t.frequency));
    assert.ok(frequencies.every((hz:number)=>Math.abs(hz-261.625565)<.001),'flat-pitch stage plays C for every event');
  } finally {await page.close();}
});

test('without Web Audio the full score and step controls remain usable',options,async()=>{
  const page=await browser.newPage({reducedMotion:'reduce'});
  try {
    await page.addInitScript(()=>{(window as any).AudioContext=undefined;});
    await page.goto(server.url+'/melody-rhythm.html');await ready(page);
    assert.match(await page.locator('.score-audio [role=status]').innerText(),/Audio is unavailable/);
    assert.equal(await page.getByRole('button',{name:'Play A: even beats',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('checkbox',{name:'Pulse'}).isDisabled(),true,'unavailable audio cannot invite another Play action through Pulse');
    const control=await browser.newPage({reducedMotion:'reduce'});
    try {
      await control.goto(server.url+'/melody-rhythm.html');await ready(control);
      assert.equal(await page.locator('.stage svg:not(.leaving)').innerHTML(),await control.locator('.stage svg:not(.leaving)').innerHTML(),'unavailable audio preserves the complete score');
    } finally {await control.close();}
    await page.locator('.step-transport button[aria-label="Next step"]').click();await ready(page,'pulse');
  } finally {await page.close();}
});
