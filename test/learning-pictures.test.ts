import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectProject} from '../tools/lib/explain-project.ts';
import {Text,Rectangle} from '../src/index.ts';

test('both piano rolls put every played pitch, onset and duration at its stated score coordinates',async()=>{
  const p=await collectProject('scenes/explainers/melody-rhythm',{write:false});
  assert.equal(p.variants.length,4);
  let pictures=0,notes=0;
  for(const variant of p.variants) await new variant.Scene({
    async frame(){},
    async stepEnd(scene,step){
      const flat=step.name==='rhythm';
      for(const [lane,id] of ['a','b'].entries()) {
        const shifted=id==='b'&&variant.values.timing==='syncopated';
        const starts=shifted?[0,1,2,3.5,4.5,5,6,7]:[0,1,2,3,4,5,6,7];
        const duration=shifted?[1,1,1.5,1,.5,1,1,1]:Array(8).fill(1);
        const names=flat?Array(8).fill('C'):['C','D','E','G','E','D','C','C'];
        const heights=flat?Array(8).fill(0):[0,.5,1,1.5,1,.5,0,0];
        for(let i=0;i<8;i++) {
          const group=scene.familyMembers().find(m=>m.key===`note-${id}-${i}`);
          assert.ok(group,`${step.name}: missing note ${id}/${i}`);
          const rect=group.children[0],text=group.children[1];
          assert.ok(rect instanceof Rectangle&&text instanceof Text);
          const [x,y]=rect.center();
          assert.ok(Math.abs(x-(-6+(starts[i]!+duration[i]!/2)*1.65))<1e-5);
          assert.ok(Math.abs(y-((lane===0?.25:-2.75)+heights[i]!))<1e-5);
          assert.ok(Math.abs(rect.width()-(duration[i]!*1.65-.08))<1e-5);
          assert.equal(text.text,names[i]);notes++;
        }
      }
      pictures++;
    },
  },{skipUntil:Infinity}).run();
  assert.equal(pictures,28);assert.equal(notes,448);
});
