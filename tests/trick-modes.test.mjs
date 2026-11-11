import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCourse,PIPE_LEFT,PIPE_RIGHT} from '../dist/course.mjs';
import {newRun,start,pause,resume,performTrick,update} from '../dist/engine.mjs';
const advanceUntil=(run,predicate)=>{for(let i=0;i<500&&run.phase==='playing'&&!predicate();i++)update(run,.05,0);assert.ok(predicate(),'expected transition occurred')};

test('all tracks are two and a half times their original length',()=>{
  for(const [difficulty,length] of [['beginner',10500],['intermediate',26250],['expert',45000]]){
    assert.equal(createCourse(difficulty,42,'downhill').length,length);
    assert.equal(createCourse(difficulty,42,'ramps').length,length);
    assert.equal(createCourse(difficulty,42,'halfpipe').length,10500);
  }
});

test('trick runs contain only accessible ramps at every difficulty',()=>{
  for(const difficulty of ['beginner','intermediate','expert']){
    const course=createCourse(difficulty,42,'ramps');
    assert.ok(course.entities.length>0);
    assert.ok(course.entities.every(entity=>entity.kind==='ramp-small'||entity.kind==='ramp-large'));
    const run=start(newRun(difficulty,course));
    for(let i=0;i<10000&&run.phase==='playing';i++)update(run,.05,0);
    assert.equal(run.phase,'finished');
    assert.ok(run.encountered.size>=3,'a straight line reaches multiple ramps');
  }
});

test('overlapping trick-run ramps do not retrigger or erase a trick',()=>{
  const course={...createCourse('beginner',42,'ramps'),initialSpeed:0,maxSpeed:0,acceleration:0,
    entities:[{id:1,kind:'ramp-small',x:360,y:80,halfWidth:28,halfHeight:22},{id:2,kind:'ramp-small',x:360,y:80,halfWidth:28,halfHeight:22}]};
  const run=start(newRun('beginner',course));run.y=80;update(run,.05,0);
  assert.equal(run.multiplier,1.25);assert.equal(performTrick(run,'720'),true);
  advanceUntil(run,()=>run.airTime===0);
  assert.equal(run.multiplier,1.25);assert.ok(run.score>=500,'the completed trick scores on landing');
  for(let i=0;i<10;i++)update(run,.05,0);
  assert.equal(run.airTime,0,'neither overlapping ramp launches the rider again');
  assert.equal(run.multiplier,1.25);
});

test('holding steering in either direction cannot trap a halfpipe rider',()=>{
  for(const direction of [-1,1]){
    const run=start(newRun('beginner',createCourse('beginner',42,'halfpipe')));
    let launches=0,wasAirborne=false;
    for(let i=0;i<350&&run.phase==='playing';i++){
      update(run,.05,direction);
      if(run.airTime>0&&!wasAirborne)launches++;
      wasAirborne=run.airTime>0;
    }
    assert.ok(launches>=2,`steering ${direction} still reaches both lips`);
  }
});

test('halfpipe launches at both lips and lands toward the opposite transition',()=>{
  const course=createCourse('beginner',42,'halfpipe');
  assert.equal(course.entities.length,0);
  const run=start(newRun('beginner',course));
  advanceUntil(run,()=>run.airTime>0);
  const rightLip=run.x,scoreBefore=run.score;
  assert.equal(rightLip,PIPE_RIGHT);assert.equal(performTrick(run,'360'),true);
  pause(run);const state=[run.x,run.y,run.time,run.airTime];update(run,.05,0);
  assert.deepEqual([run.x,run.y,run.time,run.airTime],state);resume(run);
  advanceUntil(run,()=>run.airTime===0);
  assert.equal(run.pipeDirection,-1);assert.ok(run.x<rightLip);assert.ok(run.score>=scoreBefore+200);
  advanceUntil(run,()=>run.airTime>0);
  assert.equal(run.x,PIPE_LEFT,'the rider reaches the opposite lip');
  advanceUntil(run,()=>run.airTime===0);
  assert.equal(run.pipeDirection,1);assert.ok(run.x>PIPE_LEFT);
});

test('halfpipe tricks are scored when a run reaches the finish in the air',()=>{
  const course=createCourse('beginner',42,'halfpipe');const run=start(newRun('beginner',course));
  run.y=course.length-1;run.x=PIPE_RIGHT-1;update(run,.05,0);
  assert.equal(run.phase,'playing');assert.ok(run.airTime>0);
  assert.equal(performTrick(run,'360'),true);const before=run.score;
  for(let i=0;i<100&&run.phase==='playing';i++)update(run,.05,0);
  assert.equal(run.phase,'finished');assert.ok(run.score>=before+200);
});
