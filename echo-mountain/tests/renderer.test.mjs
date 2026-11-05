import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCourse,PIPE_LEFT,PIPE_RIGHT} from '../dist/course.mjs';
import {newRun, start, TRICKS} from '../dist/engine.mjs';
import {render} from '../dist/renderer.mjs';

function rotations(name, fraction, reducedMotion=false){
  const rotations=[];
  const ctx=new Proxy({}, {get(target,key){if(key==='rotate')return angle=>rotations.push(angle);return target[key]??(()=>{})},set(target,key,value){target[key]=value;return true}});
  const course={...createCourse('intermediate'),entities:[]};
  const run=start(newRun('intermediate',course));
  run.airTime=.5;run.airDuration=1;run.airKind='small';
  run.trick={name,elapsed:TRICKS[name].duration*fraction,complete:false};
  render(ctx,{width:840,height:1000},run,'day',null,false,{reducedMotion});
  return rotations;
}
const includesAngle=(values,expected)=>values.some(value=>Math.abs(value-expected)<1e-8);
test('trick rendering rotates the rider for spins and opposite flips',()=>{
  assert.ok(includesAngle(rotations('180',.5),Math.PI/2));
  assert.ok(includesAngle(rotations('360',.5),Math.PI));
  assert.ok(includesAngle(rotations('720',.5),Math.PI*2));
  assert.ok(includesAngle(rotations('frontflip',.25),Math.PI/2));
  assert.ok(includesAngle(rotations('backflip',.25),-Math.PI/2));
  assert.ok(!includesAngle(rotations('360',.5,true),Math.PI));
});

test('sprite flips select forward and reverse frames and reduced motion uses the base pose',()=>{
  function source(name,fraction,reducedMotion=false,trickMotion=!reducedMotion){
    let drawn;const ctx=new Proxy({}, {get(target,key){if(key==='drawImage')return (...args)=>{drawn=args};return target[key]??(()=>{})},set(target,key,value){target[key]=value;return true}});
    const run=start(newRun('intermediate',{...createCourse('intermediate'),entities:[]}));
    run.airTime=.5;run.airDuration=1;run.airKind='small';run.trick={name,elapsed:TRICKS[name].duration*fraction};
    render(ctx,{width:840,height:1000},run,'day',null,false,{reducedMotion,trickMotion,sprite:{naturalWidth:400}});return drawn.slice(1,3);
  }
  assert.deepEqual(source('frontflip',.25),[0,100]);
  assert.deepEqual(source('backflip',.25),[300,200]);
  assert.deepEqual(source('frontflip',.25,true),[0,0]);
  assert.deepEqual(source('frontflip',.25,true,true),[0,100]);
});

test('practice recovery has a fallen pose and respects reduced motion',()=>{
  function angles(time,reducedMotion,phase='playing'){
    const values=[];const ctx=new Proxy({}, {get(target,key){if(key==='rotate')return value=>values.push(value);return target[key]??(()=>{})},set(target,key,value){target[key]=value;return true}});
    const course={...createCourse('beginner',42,'practice'),entities:[]};
    const run=start(newRun('beginner',course));run.recoveryTime=time;run.phase=phase;
    render(ctx,{width:840,height:1000},run,'day',null,false,{reducedMotion});return values;
  }
  assert.ok(includesAngle(angles(.175,false),.525),'rider eases upright near the end');
  assert.ok(includesAngle(angles(.175,true),1.05),'reduced motion keeps a static fallen pose');
  assert.ok(includesAngle(angles(.175,true,'paused'),1.05),'the fallen pose remains visible while paused');
  assert.ok(includesAngle(angles(0,false),0),'rider is upright after recovery');
});

test('halfpipe lips are drawn at the collision boundaries in every lighting mode',()=>{
  for(const light of ['day','sunrise','sunset','twilight','night']){
    let current=[];const paths=[];
    const ctx=new Proxy({}, {get(target,key){
      if(key==='createLinearGradient')return ()=>({addColorStop(){}});
      if(key==='beginPath')return ()=>{current=[]};
      if(key==='moveTo'||key==='lineTo')return (x,y)=>current.push([key,x,y]);
      if(key==='stroke')return ()=>paths.push({width:target.lineWidth,points:current.slice()});
      return target[key]??(()=>{});
    },set(target,key,value){target[key]=value;return true}});
    const course=createCourse('beginner',42,'halfpipe');
    render(ctx,{width:840,height:1000},newRun('beginner',course),light,null,false,{reducedMotion:true});
    for(const x of [PIPE_LEFT,PIPE_RIGHT]){
      assert.ok(paths.some(path=>path.width===5&&JSON.stringify(path.points)===JSON.stringify([['moveTo',x,0],['lineTo',x,1000]])),`${light}: lip at ${x}`);
    }
  }
});
