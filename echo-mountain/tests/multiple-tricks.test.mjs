import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WIDTH,PIPE_RIGHT} from '../dist/course.mjs';
import {newRun,start,pause,resume,performTrick,update} from '../dist/engine.mjs';

const course=(mode='downhill',entities=[],speed=0)=>({mode,difficulty:'beginner',width:WIDTH,length:10000,initialSpeed:speed,maxSpeed:speed,acceleration:0,entities});
function jump(kind='large',mode='downhill'){
  const run=start(newRun('beginner',course(mode)));run.airKind=kind;run.airDuration=kind==='large'?1.2:.95;run.airTime=run.airDuration;return run;
}
function advance(run,seconds,step=.01){let elapsed=0;while(elapsed+1e-10<seconds){const dt=Math.min(step,seconds-elapsed);update(run,dt,0);elapsed+=dt}}
function land(run,step=.01){for(let i=0;i<300&&run.airTime>0&&run.phase==='playing';i++)update(run,step,0);assert.equal(run.airTime,0,'jump should land')}
function bonus(run,multiplier=1){return run.score-run.time*15*multiplier}

test('small jumps allow one trick and rejected inputs do not consume capacity',()=>{
  const run=jump('small');assert.equal(performTrick(run,'180'),true);
  assert.equal(performTrick(run,'360'),false);assert.equal(run.trickCount,1);
  advance(run,.23);assert.deepEqual(run.completedTricks,['180']);
  assert.equal(performTrick(run,'180'),false);assert.equal(run.cue,'TRICK LIMIT REACHED');
  assert.equal(run.trickCount,1);assert.ok(Math.abs(bonus(run))<1e-7);
  land(run);assert.ok(Math.abs(bonus(run)-100)<1e-7);
});

test('large jumps score two different tricks only after landing',()=>{
  const run=jump();run.multiplier=1.5;assert.equal(performTrick(run,'180'),true);
  assert.equal(run.cue,'180 · 1/2');advance(run,.23);assert.equal(performTrick(run,'360'),true);assert.equal(run.cue,'360 · 2/2');advance(run,.35);
  assert.deepEqual(run.completedTricks,['180','360']);assert.equal(run.trickCount,2);
  assert.equal(performTrick(run,'180'),false);assert.equal(run.cue,'TRICK LIMIT REACHED');
  assert.ok(Math.abs(bonus(run,1.5))<1e-7);land(run);
  assert.ok(Math.abs(bonus(run,1.5)-450)<1e-7);const score=run.score;update(run,.05,0);assert.ok(run.score-score<2);
});

test('large jumps accept the same trick twice when separately requested',()=>{
  const run=jump();assert.equal(performTrick(run,'360'),true);advance(run,.35);
  assert.equal(performTrick(run,'360'),true);advance(run,.35);land(run);
  assert.ok(Math.abs(bonus(run)-400)<1e-7);
});

test('two-trick landing works in Downhill, Practice, and Trick Run',()=>{
  for(const mode of ['downhill','practice','ramps']){
    const run=jump('large',mode);assert.equal(performTrick(run,'180'),true);advance(run,.23);
    assert.equal(performTrick(run,'360'),true);advance(run,.35);land(run);
    assert.ok(Math.abs(bonus(run)-300)<1e-7,`${mode} awards both tricks`);
  }
});

test('two 720s complete in a large jump at both fixed update rates',()=>{
  for(const step of [1/60,.05]){
    const run=jump();assert.equal(performTrick(run,'720'),true);
    for(let i=0;i<100&&!run.trick.complete;i++)update(run,step,0);
    assert.ok(run.trick.complete);assert.equal(performTrick(run,'720'),true);
    for(let i=0;i<100&&run.airTime>0;i++)update(run,step,0);
    assert.equal(run.airTime,0);assert.ok(Math.abs(bonus(run)-800)<1e-7);
  }
});

test('a too-late trick leaves the slot available for a shorter trick',()=>{
  const run=jump();advance(run,.95);assert.equal(performTrick(run,'720'),false);
  assert.equal(run.cue,'NOT ENOUGH AIRTIME');assert.equal(run.trickCount,0);
  assert.equal(performTrick(run,'180'),true);land(run);assert.ok(Math.abs(bonus(run)-100)<1e-7);
});

test('jump capacity resets on a new ramp and on a fresh run',()=>{
  const ramp={id:1,kind:'ramp-small',x:WIDTH/2,y:400,halfWidth:28,halfHeight:22};
  const run=jump();assert.equal(performTrick(run,'180'),true);advance(run,.23);assert.equal(performTrick(run,'180'),true);land(run);
  assert.equal(run.trickCount,0);assert.deepEqual(run.completedTricks,[]);
  run.course.entities=[ramp];run.x=WIDTH/2;run.y=400;update(run,.01,0);
  assert.equal(run.airKind,'small');assert.equal(run.trickCount,0);assert.equal(performTrick(run,'180'),true);
  advance(run,.23);assert.equal(performTrick(run,'180'),false);
  const fresh=newRun('beginner',course());assert.equal(fresh.trickCount,0);assert.deepEqual(fresh.completedTricks,[]);
});

test('pausing freezes active tricks and pending scores',()=>{
  const run=jump();assert.equal(performTrick(run,'180'),true);advance(run,.23);assert.equal(performTrick(run,'360'),true);advance(run,.1);
  pause(run);const snapshot=[run.airTime,run.time,run.score,run.trick.elapsed,...run.completedTricks];advance(run,.5);
  assert.deepEqual([run.airTime,run.time,run.score,run.trick.elapsed,...run.completedTricks],snapshot);
  resume(run);land(run);assert.ok(Math.abs(bonus(run)-300)<1e-7);
});

test('collision on the landing frame cancels pending tricks in Downhill and Practice',()=>{
  for(const mode of ['downhill','practice']){
    const obstacle={id:1,kind:'tree',x:WIDTH/2,y:238,halfWidth:27,halfHeight:27};
    const run=start(newRun('beginner',course(mode,[obstacle],200)));run.airTime=1;run.airDuration=1;run.airKind='small';
    assert.equal(performTrick(run,'360'),true);for(let i=0;i<30&&run.phase==='playing'&&!run.recoveryTime;i++)update(run,.05,0);
    assert.equal(mode==='practice'?run.recoveryTime>0:run.phase==='crashed',true);
    assert.deepEqual(run.completedTricks,[]);assert.equal(run.trickCount,0);
    if(mode==='practice')assert.equal(run.score,0);else assert.ok(run.score<100);
  }
});

test('collision on landing cancels both completed tricks',()=>{
  for(const mode of ['downhill','practice']){
    const obstacle={id:1,kind:'tree',x:WIDTH/2,y:278,halfWidth:27,halfHeight:27};
    const run=start(newRun('beginner',course(mode,[obstacle],200)));run.airTime=1.2;run.airDuration=1.2;run.airKind='large';
    assert.equal(performTrick(run,'180'),true);advance(run,.25,.05);
    assert.equal(performTrick(run,'360'),true);advance(run,.35,.05);
    assert.deepEqual(run.completedTricks,['180','360']);
    for(let i=0;i<30&&run.phase==='playing'&&!run.recoveryTime;i++)update(run,.05,0);
    assert.equal(mode==='practice'?run.recoveryTime>0:run.phase==='crashed',true);
    assert.deepEqual(run.completedTricks,[]);assert.equal(run.trickCount,0);
    if(mode==='practice')assert.equal(run.score,0);else assert.ok(run.score<100,'no trick bonuses awarded');
  }
});

test('a fall cancels a completed first trick and an unfinished second trick',()=>{
  for(const mode of ['downhill','practice']){
    const obstacle={id:1,kind:'tree',x:WIDTH/2,y:1000,halfWidth:27,halfHeight:27};
    const run=start(newRun('beginner',course(mode,[obstacle])));run.airTime=1.2;run.airDuration=1.2;run.airKind='small';
    // A large jump cannot clear an obstacle, so use a small jump after starting the trick sequence.
    run.airKind='large';assert.equal(performTrick(run,'180'),true);advance(run,.23);assert.equal(performTrick(run,'360'),true);
    run.airKind='small';run.y=1000;update(run,.01,0);
    assert.equal(mode==='practice'?run.recoveryTime>0:run.phase==='crashed',true);
    assert.deepEqual(run.completedTricks,[]);assert.equal(run.trickCount,0);assert.ok(run.score<100);
  }
});

test('a new airborne ramp replaces rather than scores the previous jump',()=>{
  const ramp={id:1,kind:'ramp-small',x:WIDTH/2,y:1000,halfWidth:28,halfHeight:22};
  const run=jump();run.course.entities=[ramp];assert.equal(performTrick(run,'180'),true);advance(run,.23);
  run.y=1000;update(run,.01,0);assert.equal(run.airKind,'small');assert.deepEqual(run.completedTricks,[]);
  land(run);assert.ok(bonus(run)<100,'the interrupted jump did not award trick points');
});

test('halfpipe lip accepts two tricks and pays on landing after reaching the finish',()=>{
  const model={...course('halfpipe',[],200),length:100};const run=start(newRun('beginner',model));
  run.y=99;run.x=PIPE_RIGHT-1;update(run,.01,0);assert.ok(run.airTime>0);assert.equal(run.phase,'playing');
  assert.equal(performTrick(run,'180'),true);advance(run,.23);assert.equal(performTrick(run,'360'),true);
  for(let i=0;i<300&&run.phase==='playing';i++)update(run,.01,0);
  assert.equal(run.phase,'finished');assert.ok(run.score>=375,'both tricks score at the lip multiplier');
});
