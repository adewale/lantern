import {stepAudio} from '../explain/audio.ts';
import type {AudioClip} from '../explain/audio.ts';
import {UNITS} from '../src/svg.ts';

/** Optional reader module. Only pages with authored audio import this code. */
export function mountAudio(stage: HTMLElement, frame: HTMLElement) {
  const panel=document.createElement('div');panel.className='score-audio';panel.hidden=true;panel.lang='en';
  panel.setAttribute('role','group');panel.setAttribute('aria-label','Listen to this score');
  const buttons=document.createElement('div');buttons.className='score-audio-buttons';
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Ready. Sound starts when you press Play.';
  const elapsed=document.createElement('output');elapsed.setAttribute('aria-hidden','true');
  const pulseLabel=document.createElement('label'),pulse=document.createElement('input');pulse.type='checkbox';pulse.checked=true;
  pulseLabel.append(pulse,' Pulse');
  const stopButton=document.createElement('button');stopButton.type='button';stopButton.textContent='Stop';stopButton.disabled=true;
  panel.append(buttons,status);frame.after(panel);
  let context: AudioContext | null=null, generation=0, animation=0, cursor: SVGLineElement | null=null;
  const active=new Map<OscillatorNode,GainNode>();
  function revealScore() {
    // A click or keyboard focus can scroll the controls into view while hiding
    // the score. Native scrolling also reveals it through a host iframe or a
    // fullscreen scroll container, where window.scrollBy cannot reach it.
    panel.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    stage.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  }
  function stop() {
    generation++;
    cancelAnimationFrame(animation);
    for(const [osc,gain] of active) {osc.stop();osc.disconnect();gain.disconnect();}
    active.clear();cursor?.remove();cursor=null;stopButton.disabled=true;
    panel.dataset.playing='false';elapsed.value='';
  }
  function tone(ctx:AudioContext,midi:number,start:number,duration:number,volume:number) {
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type='triangle';osc.frequency.setValueAtTime(440*2**((midi-69)/12),start);
    const edge=Math.min(0.012,duration/4);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+edge);
    gain.gain.setValueAtTime(volume,start+duration-edge);gain.gain.linearRampToValueAtTime(0,start+duration);
    osc.connect(gain);gain.connect(ctx.destination);active.set(osc,gain);
    osc.onended=()=>{osc.disconnect();gain.disconnect();active.delete(osc);};
    osc.start(start);osc.stop(start+duration);
  }
  async function play(clip:AudioClip) {
    stop();const token=generation;
    stopButton.disabled=false;status.textContent=`Starting ${clip.id.toUpperCase()}.`;
    try {
      if(!context||context.state==='closed') context=new AudioContext();
      const ctx=context;
      await ctx.resume();
      if(token!==generation) return;
      const seconds=60/clip.bpm,start=ctx.currentTime+0.04,total=clip.beats*seconds;
      // Equal-time note endings precede starts, so adjacent notes retain the
      // monophonic level. Chords share that level instead of clipping the mix.
      const events=clip.notes.flatMap(n=>[{at:n.at,change:1},{at:n.at+n.duration,change:-1}])
        .sort((a,b)=>a.at-b.at||a.change-b.change);
      let voices=0,peak=1;
      for(const event of events) {voices+=event.change;peak=Math.max(peak,voices);}
      for(const note of clip.notes) tone(ctx,note.midi,start+note.at*seconds,note.duration*seconds,0.09/peak);
      if(pulse.checked) for(let beat=0;beat<clip.beats;beat++) tone(ctx,beat%4===0?88:81,start+beat*seconds,0.045,0.025);
      const svg=stage.querySelector('svg:not(.leaving)');
      if(svg&&clip.plot) {
        const [left,bottom,,top]=clip.plot;
        cursor=document.createElementNS('http://www.w3.org/2000/svg','line');
        cursor.setAttribute('class','score-playhead');cursor.setAttribute('aria-hidden','true');
        cursor.setAttribute('x1',String(left*UNITS));cursor.setAttribute('x2',String(left*UNITS));
        cursor.setAttribute('y1',String(-top*UNITS));cursor.setAttribute('y2',String(-bottom*UNITS));
        cursor.setAttribute('stroke','#d35400');cursor.setAttribute('stroke-width','45');
        svg.append(cursor);
      }
      panel.dataset.playing='true';stopButton.disabled=false;status.textContent=`Playing ${clip.id.toUpperCase()} at ${clip.bpm} BPM.`;
      const tick=()=>{
        if(token!==generation) return;
        const t=Math.max(0,ctx.currentTime-start);
        if(t>=total) {stop();status.textContent=`Finished ${clip.id.toUpperCase()}.`;return;}
        elapsed.value=`Beat ${Math.min(Math.floor(t/seconds)+1,Math.ceil(clip.beats))} / ${clip.beats}`;
        if(cursor&&clip.plot) {
          const x=(clip.plot[0]+(clip.plot[2]-clip.plot[0])*Math.min(t/total,1))*UNITS;
          cursor.setAttribute('x1',String(x));cursor.setAttribute('x2',String(x));
        }
        animation=requestAnimationFrame(tick);
      };
      tick();
      revealScore();
    } catch {
      if(token!==generation) return;
      stop();status.textContent='Audio could not start. The score remains available; try Play again.';
    }
  }
  stopButton.onclick=()=>{stop();status.textContent='Stopped.';};
  pulse.onchange=()=>{stop();status.textContent='Pulse changed. Press Play to hear it.';};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();status.textContent='Stopped while the page is hidden.';}});
  window.addEventListener('pagehide',()=>{stop();if(context && context.state!=='closed') void context.close().catch(()=>{});});
  return {
    stop() {
      stop();
      // Navigation invalidates the score before its new picture is ready.
      for(const b of buttons.querySelectorAll('button')) b.disabled=true;
    },
    set(value:unknown) {
      stop();const audio=stepAudio(value);panel.hidden=!audio;
      buttons.replaceChildren();
      if(!audio) return;
      pulse.disabled=typeof AudioContext==='undefined';
      for(const clip of audio.clips) {
        const b=document.createElement('button');b.type='button';b.textContent=`Play ${clip.id.toUpperCase()}`;
        // The accessible name must contain the visible button text for voice input.
        b.setAttribute('aria-label',clip.label.includes(b.textContent)?clip.label:`${b.textContent}: ${clip.label}`);b.onclick=()=>void play(clip);
        b.disabled=typeof AudioContext==='undefined';buttons.append(b);
      }
      buttons.append(stopButton,pulseLabel,elapsed);
      status.textContent=typeof AudioContext==='undefined'?'Audio is unavailable in this browser. The score is still shown.':'Ready. Sound starts when you press Play.';
    },
  };
}
