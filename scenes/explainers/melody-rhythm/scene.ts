import {Scene,Group,Rectangle} from 'rayner';
import {settingsOf} from 'rayner/explain';
import type {AudioClip,Stage} from 'rayner/explain';
import {musicStory,NOTE_NAMES} from '../lib/melody-rhythm.ts';
import type {Timing} from '../lib/melody-rhythm.ts';
import {lesson,label,segment} from '../lib/lesson-drawing.ts';

function scorePicture(s:Stage,clips:AudioClip[],phase:number) {
  const figure=new Group();figure.key='music-score';
  clips.forEach((clip,lane)=>{
    const base=lane===0?0.25:-2.75,top=base+1.5,x0=-6,x1=7.2,dx=(x1-x0)/8;
    const row=new Group(label(lane===0?'A: even beats':clip.id==='b'&&clip.notes[3]!.at===3.5?'B: shifted timing':'B: even beats',0,top+0.8,s.palette.ink,0.6));
    row.key=`score-${clip.id}`;
    for(let beat=0;beat<=8;beat++) row.add(segment([x0+beat*dx,base-0.3],[x0+beat*dx,top+0.25],beat===4||phase===1?s.emphasis:s.soft,beat===4?0.04:phase===1?0.035:0.012));
    clip.notes.forEach((note,i)=>{
      const y=base+[60,62,64,67].indexOf(note.midi)*0.5,x=x0+(note.at+note.duration/2)*dx;
      const marked=(phase===5&&lane===1&&i===3)||(phase===4&&(i===3||i===4));
      const rect=new Rectangle({width:note.duration*dx-0.08,height:0.6,fill:s.palette.paper,
        stroke:marked?s.bad:s.emphasis,strokeWidth:marked?0.055:0.03}).moveTo([x,y]);
      const g=new Group(rect,label(NOTE_NAMES[note.midi]!,x,y,s.palette.ink,0.6));g.key=`note-${clip.id}-${i}`;row.add(g);
    });
    figure.add(row);
  });
  figure.add(label('Bar 1: four beats',-2.7,-3.6,s.soft,0.6),label('Bar 2: four beats',4.0,-3.6,s.soft,0.6));
  return figure;
}
export default class MelodyRhythm extends Scene {
  static meta={id:'melody-rhythm',title:'Why do the same pitches sound different when their timing changes?',sources:[
    'https://learningmusic.ableton.com/make-beats/make-beats.html',
    'https://learningmusic.ableton.com/melodies/melodies.html',
    'https://www.w3.org/TR/2021/REC-webaudio-20210617/#OscillatorNode',
  ]};
  static settings=[
    {id:'timing',label:'Version B',default:'syncopated',options:[{value:'syncopated',label:'Shift two note starts'},{value:'straight',label:'Keep the same timing as A'}]},
    {id:'tempo',label:'Tempo',default:'96',options:[{value:'96',label:'96 BPM'},{value:'120',label:'120 BPM'}]},
  ];
  override async construct() {
    const v=settingsOf(this),m=musicStory(v.timing as Timing,Number(v.tempo)),different=m.movedStarts>0;
    const titles=['Listen to A and B','The grid supplies a steady pulse','Keep the timing and flatten the pitches','Restore the rising and falling pitches',different?'Two note starts change':'The two versions keep identical timing',different?'G crosses the strong bar boundary':'G ends at the bar boundary',different?'Timing changes the heard phrase':'Matching pitches and timing give the same phrase'];
    const lines=['Use Play A and Play B below the picture.','Each bar contains four beats; horizontal position is time.','Every event is C; starts and durations are retained.','The original pitch order returns without moving the events.',different?'The pitch sequence stays C D E G E D C C.':'A and B share the same pitch order, starts and durations.',different?'The outlined G starts between beats and continues into bar 2.':'The outlined G finishes as bar 2 starts.','Both versions use the same instrument, loudness and tempo.'];
    const captions=[
      different?'A and B use the same eight pitches in the same order, but two note starts and two durations differ. Listen to both, then follow the positions and lengths of their note rectangles.':'A and B use identical pitches, starts and durations. This control case gives the same phrase twice; the shifted-timing setting changes the comparison.',
      `The eight-beat phrase occupies two bars of four beats at ${m.bpm} BPM. The moving playhead follows the same beat positions used to schedule the sound. A rectangle’s height gives pitch; its width gives duration.`,
      'All events now play C, while each version keeps its own note starts and durations. Removing the rising and falling pitch pattern makes the timing easier to hear.',
      'The pitch order C D E G E D C C returns. Those rises and falls now combine with the timing pattern to make the heard phrase.',
      different?'Version A starts each note on a beat. In B, G starts half a beat before the second bar and the following E starts half a beat into that bar. The pitch order stays fixed.':'Version B has not moved any note starts or changed any durations. Its piano roll coincides with A’s timing, so this setting supplies a comparison with no rhythmic change.',
      different?'B’s G begins between beats and continues across the first beat of bar 2. Hear it against the steady pulse: a note can carry its emphasis across a strong beat instead of beginning there.':'In this straight-timing case, G occupies the last beat of bar 1 and ends at its boundary. A new E begins on the first beat of bar 2; no note is held across that boundary.',
      different?'The two versions preserve all eight pitches, their order, instrument, loudness and tempo. Moving two starts and changing two durations changes how that pitch contour meets the beat. Both dimensions contribute to the phrase.':'All pitches, their order, starts and durations match. With the same instrument, loudness and tempo, A and B produce the same phrase. Select shifted timing to hear the effect of changing the rhythm.',
    ];
    await lesson(this,titles.map((title,i)=>{
      const clips=i===2?m.flat:m.clips;
      return {id:['listen','pulse','rhythm','contour','timing','bar','phrase'][i]!,title,line:lines[i]!,caption:captions[i]!,
        state:{timing:m.timing,bpm:m.bpm,clips,movedStarts:m.movedStarts,movedDurations:m.movedDurations,crossing:clips[1]!.notes.filter(n=>n.at<4&&n.at+n.duration>4)},
        audio:{clips},draw:(s:Stage)=>scorePicture(s,clips,i)};
    }),'nord');
  }
}
