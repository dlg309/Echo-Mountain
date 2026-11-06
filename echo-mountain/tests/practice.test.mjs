import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCourse,WIDTH} from '../dist/course.mjs';
import {newRun,start,pause,resume,endPractice,performTrick,update,PRACTICE_RECOVERY_SECONDS} from '../dist/engine.mjs';
import {saveRun,validRecord} from '../dist/records.mjs';

const tree=(id,y)=>({id,kind:'tree',x:WIDTH/2,y,halfWidth:27,halfHeight:27});
const course=(entities,mode='practice',length=1000)=>({mode,difficulty:'beginner',width:WIDTH,length,initialSpeed:200,maxSpeed:200,acceleration:0,entities});
const until=(run,predicate,limit=1000)=>{for(let i=0;i<limit&&!predicate();i++)update(run,.05,0);assert.ok(predicate(),'expected state was reached')};

test('practice uses the same generated downhill layout for every difficulty',()=>{
  for(const difficulty of ['beginner','intermediate','expert'])for(const seed of [0,8,42]){
    const practice=createCourse(difficulty,seed,'practice');const {mode,endless,segmentIndex,generatedUntil,...geometry}=practice;
    assert.equal(mode,'practice');assert.deepEqual(geometry,createCourse(difficulty,seed,'downhill'));
    assert.equal(endless,true);assert.equal(segmentIndex,0);assert.equal(generatedUntil,geometry.length);
  }
});

test('practice generates new terrain beyond the former finish and keeps memory bounded',()=>{
  for(const difficulty of ['beginner','intermediate','expert']){
    const model=createCourse(difficulty,42,'practice');const run=start(newRun(difficulty,model));
    const segmentLength=model.length;run.y=segmentLength*5+10;update(run,.05,0);
    assert.equal(run.phase,'playing');assert.ok(run.y>segmentLength*5);
    assert.ok(model.generatedUntil>run.y+5000);assert.ok(model.segmentIndex>=5);
    assert.ok(model.entities.some(entity=>entity.y>segmentLength*5),'new obstacles exist beyond the original track');
    assert.ok(model.entities.every(entity=>entity.y>=segmentLength*3),'old segments are discarded');
    assert.equal(new Set(model.entities.map(entity=>entity.id)).size,model.entities.length,'segment IDs stay unique');
  }
});

test('ending endless practice saves distances beyond the original track',()=>{
  const model=createCourse('beginner',42,'practice'),run=start(newRun('beginner',model));
  run.y=model.length+500;pause(run);endPractice(run);assert.equal(run.phase,'finished');
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const records=saveRun(storage,run);assert.equal(records.beginner.last.distance,model.length+500);
  assert.equal(validRecord(records.beginner.last,createCourse('beginner',42,'practice')),true);
  const normal=start(newRun('beginner',createCourse('beginner',42)));endPractice(normal);assert.equal(normal.phase,'playing');
});

test('a practice collision resets scoring and recovery holds position while time continues',()=>{
  const run=start(newRun('beginner',course([tree(1,80)])));run.score=200;run.multiplier=3;
  until(run,()=>run.recoveryTime>0);
  assert.equal(run.phase,'playing');assert.equal(run.score,0);assert.equal(run.multiplier,1);
  assert.equal(run.recoveryTime,PRACTICE_RECOVERY_SECONDS);assert.ok(run.y>0);assert.ok(run.encountered.has(1));
  const {x,y,time}=run;
  for(let i=0;i<5;i++)update(run,.05,1);
  assert.deepEqual([run.x,run.y],[x,y]);assert.ok(run.time>time);
  assert.equal(run.score,0);assert.equal(run.multiplier,1);
  until(run,()=>run.recoveryTime===0);
  assert.deepEqual([run.x,run.y],[x,y]);
  update(run,.05,0);assert.ok(run.y>y);assert.equal(run.recoveryTime,0);assert.ok(run.score>0);
});

test('only the hit obstacle is ignored and a later collision resets a new score',()=>{
  const run=start(newRun('beginner',course([tree(1,80),tree(2,200)])));
  until(run,()=>run.recoveryTime>0);until(run,()=>run.recoveryTime===0);
  update(run,.05,0);assert.equal(run.recoveryTime,0);assert.ok(run.score>0);
  run.score=75;run.multiplier=2;
  until(run,()=>run.recoveryTime>0);
  assert.ok(run.encountered.has(1));assert.ok(run.encountered.has(2));
  assert.equal(run.score,0);assert.equal(run.multiplier,1);assert.equal(run.phase,'playing');
});

test('pause freezes recovery time, elapsed time, and position until resume',()=>{
  const run=start(newRun('beginner',course([tree(1,80)])));until(run,()=>run.recoveryTime>0);
  pause(run);const before=[run.x,run.y,run.time,run.recoveryTime,run.cueTime];
  for(let i=0;i<40;i++)update(run,.05,1);
  assert.deepEqual([run.x,run.y,run.time,run.recoveryTime,run.cueTime],before);
  resume(run);update(run,.05,1);
  assert.deepEqual([run.x,run.y],before.slice(0,2));assert.ok(run.recoveryTime<before[3]);
});

test('colliding during an uncleared trick cancels it without landing points',()=>{
  const run=start(newRun('beginner',course([tree(1,80)])));
  run.airTime=.8;run.airDuration=.8;run.airKind='small';assert.equal(performTrick(run,'360'),true);
  until(run,()=>run.recoveryTime>0);
  assert.equal(run.score,0);assert.equal(run.trick,null);assert.equal(run.airTime,0);assert.equal(run.airKind,null);
  assert.equal(performTrick(run,'180'),false);
  until(run,()=>run.recoveryTime===0);assert.equal(run.score,0);
});

test('practice can finish after recovery and a fresh run has no pending state',()=>{
  const model=course([tree(1,80)],'practice',150);const run=start(newRun('beginner',model));
  until(run,()=>run.recoveryTime>0);const fresh=newRun('beginner',model);
  assert.equal(fresh.phase,'ready');assert.equal(fresh.recoveryTime,0);assert.equal(fresh.encountered.size,0);
  until(run,()=>run.phase==='finished');assert.equal(run.y,150);
  const normal=start(newRun('beginner',course([tree(1,80)],'downhill')));
  until(normal,()=>normal.phase==='crashed');assert.equal(normal.recoveryTime,0);
});
