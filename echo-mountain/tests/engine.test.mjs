import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCourse, LEVELS, WIDTH} from '../dist/course.mjs';
import {newRun,start,pause,resume,performTrick,update,formatTime,RIDER_RADIUS} from '../dist/engine.mjs';
import {loadRecords,saveRun,validRecord} from '../dist/records.mjs';

const course=(entities=[],overrides={})=>({difficulty:'beginner',width:WIDTH,length:1000,initialSpeed:200,maxSpeed:200,acceleration:0,entities,...overrides});
const ride=(run,seconds,direction=0)=>{for(let i=0;i<Math.ceil(seconds/.05);i++)update(run,.05,direction);return run};
const memoryStorage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}};

test('courses are stable, get longer and deliver the requested difficulty mix',()=>{
  const b=createCourse('beginner'),i=createCourse('intermediate'),e=createCourse('expert');
  assert.deepEqual(createCourse('expert'),e);
  assert.ok(b.length<i.length && i.length<e.length);
  assert.ok(b.entities.every(x=>x.kind==='tree'));
  for(const kind of ['tree','rock','fence','ramp-small']) assert.ok(i.entities.some(x=>x.kind===kind),kind);
  for(const kind of ['fence','ramp-small','ramp-large']) assert.ok(e.entities.some(x=>x.kind===kind),kind);
  const count=(c,kinds)=>c.entities.filter(x=>kinds.includes(x.kind)).length;
  for(const kind of ['tree','rock']) assert.ok(e.entities.some(x=>x.kind===kind),kind);
  assert.ok(count(e,['ramp-small','ramp-large'])>count(i,['ramp-small','ramp-large']));
  assert.ok(e.initialSpeed>i.initialSpeed && i.maxSpeed<e.maxSpeed);
});
test('ready runs do not advance, and steering remains within the course',()=>{
  const r=newRun('beginner',course());update(r,.05,1);assert.equal(r.y,0);start(r);
  ride(r,2,-1);assert.equal(r.x,RIDER_RADIUS);ride(r,4,1);assert.equal(r.x,WIDTH-RIDER_RADIUS);
});
test('intermediate acceleration rises to its cap and stays capped',()=>{
  const c=course([],{length:20000,initialSpeed:100,maxSpeed:220,acceleration:10});const r=start(newRun('intermediate',c));
  ride(r,.5);assert.ok(r.speed>100 && r.speed<220);ride(r,12);assert.equal(r.speed,220);ride(r,2);assert.equal(r.speed,220);
});
test('colliding ends the run and freezes score, time, and position',()=>{
  const r=start(newRun('beginner',course([{id:0,kind:'tree',x:360,y:100,halfWidth:27,halfHeight:27}])));
  ride(r,2);assert.equal(r.phase,'crashed');const snapshot=[r.time,r.y,r.score,r.multiplier];ride(r,2);assert.deepEqual([r.time,r.y,r.score,r.multiplier],snapshot);
});
test('a close call increases multiplier exactly once without a collision',()=>{
  const r=start(newRun('beginner',course([{id:0,kind:'tree',x:410,y:100,halfWidth:27,halfHeight:27}])));
  ride(r,1);assert.equal(r.phase,'playing');assert.equal(r.multiplier,1.25);ride(r,1);assert.equal(r.multiplier,1.25);assert.ok(r.score>15);
});
test('close calls and ramps raise the multiplier beyond 5×',()=>{
  const objects=[
    {id:0,kind:'tree',x:410,y:100,halfWidth:27,halfHeight:27},
    {id:1,kind:'tree',x:410,y:200,halfWidth:27,halfHeight:27},
    {id:2,kind:'ramp-large',x:360,y:350,halfWidth:39,halfHeight:27},
  ];
  const run=start(newRun('beginner',course(objects)));run.multiplier=4.75;
  ride(run,1.25);assert.equal(run.multiplier,5.25);
  ride(run,.4);assert.equal(run.multiplier,5.75);
  const score=run.score;update(run,.05,0);assert.ok(run.score-score>4,'the higher multiplier increases the score');
});
test('ramps trigger airtime and award one multiplier bonus for each size',()=>{
  for(const [kind,amount] of [['ramp-small',1.25],['ramp-large',1.5]]){
    const r=start(newRun('expert',course([{id:0,kind,x:360,y:100,halfWidth:28,halfHeight:22}])));
    while(r.y<90)update(r,.05,0);assert.ok(r.airTime>0);assert.equal(r.multiplier,amount);ride(r,.5);assert.equal(r.multiplier,amount);
  }
});
test('the finish ends the run once and a new run starts clean',()=>{
  const r=start(newRun('beginner',course([],{length:100})));ride(r,2);assert.equal(r.phase,'finished');assert.equal(r.y,100);const t=r.time;ride(r,1);assert.equal(r.time,t);
  const next=newRun('beginner',course());assert.equal(next.phase,'ready');assert.equal(next.y,0);assert.equal(next.score,0);assert.equal(next.multiplier,1);
});
test('last and longest runs persist separately by difficulty',()=>{
  const s=memoryStorage();let r=start(newRun('beginner',course()));r.y=400;r.score=90;r.phase='crashed';saveRun(s,r);
  r=start(newRun('beginner',course()));r.y=250;r.phase='crashed';saveRun(s,r);
  let records=loadRecords(s);assert.equal(records.beginner.last.distance,250);assert.equal(records.beginner.best.distance,400);
  r=start(newRun('expert',course()));r.y=550;r.phase='finished';saveRun(s,r);records=loadRecords(s);
  assert.equal(records.beginner.best.distance,400);assert.equal(records.expert.last.distance,550);assert.equal(records.expert.best.phase,'finished');
  assert.equal(validRecord(records.beginner.last,course()),true);assert.equal(validRecord({distance:-1,x:1},course()),false);
});
test('invalid storage and time formatting are handled safely',()=>{
  assert.deepEqual(loadRecords({getItem:()=>'{broken'}),{});assert.equal(formatTime(65.25),'01:05.25');
});
test('rocks and snow fences end the run, including the edge of a fence',()=>{
  for(const object of [
    {id:0,kind:'rock',x:360,y:100,halfWidth:24,halfHeight:20},
    {id:0,kind:'fence',x:399,y:100,halfWidth:41,halfHeight:10},
  ]){
    const r=start(newRun('intermediate',course([object])));ride(r,1);assert.equal(r.phase,'crashed',object.kind);
  }
});
test('only completed or crashed runs are recorded',()=>{
  const s=memoryStorage(),r=start(newRun('beginner',course()));ride(r,.2);saveRun(s,r);assert.deepEqual(loadRecords(s),{});
});
test('each generated course has a rideable route to its finish',()=>{
  for(const difficulty of Object.keys(LEVELS)){
    const generated=createCourse(difficulty),rows=[];
    for(const e of generated.entities)if(!rows.length||e.y-rows.at(-1)>100)rows.push(e.y);
    const r=start(newRun(difficulty,generated));let index=0;
    for(let tick=0;tick<12000 && r.phase==='playing';tick++){
      while(index<rows.length-1 && r.y>rows[index]+90)index++;
      let safe=Math.floor(index/5)%10;safe=safe<5?safe:9-safe;
      const target=[75,188,301,419,532,645][safe];
      update(r,1/60,Math.abs(target-r.x)<5?0:Math.sign(target-r.x));
    }
    assert.equal(r.phase,'finished',`${difficulty} course should be traversable`);
  }
});

test('different seeds reshuffle courses, with separated and compatible ramp targets',async()=>{
  const {MIN_RAMP_SPACING}=await import('../dist/course.mjs');
  for(const name of ['intermediate','expert']){
    assert.notDeepEqual(createCourse(name,101).entities,createCourse(name,202).entities);
    for(let seed=1;seed<=30;seed++){
      const c=createCourse(name,seed),ramps=c.entities.filter(e=>e.kind.startsWith('ramp')).sort((a,b)=>a.y-b.y);
      for(let i=0;i<ramps.length;i++){
        const r=ramps[i],target=c.entities.find(e=>e.id===r.pairedObstacleId);
        assert.ok(target&&target.pairedRampId===r.id);
        assert.equal(target.x,r.x);assert.ok(target.y>r.y);
        assert.ok((r.kind==='ramp-small'?['rock-small','fence']:['rock-small','rock','tree','fence']).includes(target.kind));
        if(i)assert.ok(r.y-ramps[i-1].y>=MIN_RAMP_SPACING);
      }
    }
  }
});
test('paired ramps clear their obstacles and provide a safe landing at minimum and maximum speed',()=>{
  let checked=0;
  for(const name of ['intermediate','expert']){
    for(let seed=1;seed<=25;seed++){
      const c=createCourse(name,seed);
      for(const ramp of c.entities.filter(e=>e.kind.startsWith('ramp'))){
        checked++;
        const target=c.entities.find(e=>e.id===ramp.pairedObstacleId);
        for(const speed of [c.initialSpeed,c.maxSpeed]){
          const model={...c,initialSpeed:speed,maxSpeed:speed,acceleration:0};
          const r=start(newRun(name,model));r.x=ramp.x;r.y=ramp.y-75;
          const stop=ramp.y+speed*(ramp.kind==='ramp-small'?.95:1.2)+60;
          for(let t=0;t<500&&r.phase==='playing'&&r.y<stop;t++)update(r,.01,0);
          assert.equal(r.phase,'playing',`${name} ${ramp.kind} ${target.kind} at ${speed}`);
          assert.ok(r.encountered.has(target.id),'target was cleared');
          assert.equal(r.airTime,0,'the rider has landed');
        }
      }
    }
  }
  assert.ok(checked>0,'generated courses contain ramps to test');
});
test('small jumps clear only small rocks or fences; large jumps can clear trees and rocks',()=>{
  const trial=(rampKind,obstacleKind,halfWidth,halfHeight)=>{
    const objects=[{id:0,kind:rampKind,x:360,y:80,halfWidth:28,halfHeight:22},{id:1,kind:obstacleKind,x:360,y:150,halfWidth,halfHeight}];
    return ride(start(newRun('expert',course(objects,{length:1000}))),1);
  };
  assert.equal(trial('ramp-small','rock-small',15,13).phase,'playing');
  assert.equal(trial('ramp-small','fence',41,10).phase,'playing');
  assert.equal(trial('ramp-small','tree',27,27).phase,'crashed');
  assert.equal(trial('ramp-small','rock',24,20).phase,'crashed');
  assert.equal(trial('ramp-large','tree',27,27).phase,'playing');
  assert.equal(trial('ramp-large','rock',24,20).phase,'playing');
});
test('obstacles still cause a crash when the rider has not taken a ramp',()=>{
  const r=start(newRun('intermediate',course([{id:1,kind:'rock-small',x:360,y:150,halfWidth:15,halfHeight:13}])));
  ride(r,1);assert.equal(r.phase,'crashed');
});
test('expert fog preserves a clear reaction zone that scales with speed',async()=>{
  const {fogDistance,fogOpacity,CLEAR_REACTION_SECONDS,DENSE_REACTION_SECONDS,MAX_FOG_OPACITY}=await import('../dist/fog.mjs');
  for(const speed of [270,340]){
    const d=fogDistance(speed);assert.equal(d.clear,speed*CLEAR_REACTION_SECONDS);assert.equal(d.dense,speed*DENSE_REACTION_SECONDS);
    assert.equal(fogOpacity(d.clear,speed),0);assert.equal(fogOpacity(d.dense,speed),MAX_FOG_OPACITY);
    assert.ok(fogOpacity((d.clear+d.dense)/2,speed)>0&&fogOpacity((d.clear+d.dense)/2,speed)<MAX_FOG_OPACITY);
  }
});
test('random courses preserve a rideable safe route for many seeds',async()=>{
  const {LANES}=await import('../dist/course.mjs');
  for(const name of Object.keys(LEVELS))for(let seed=1;seed<=60;seed++){
    const c=createCourse(name,seed),r=start(newRun(name,c));let i=0;
    for(let tick=0;tick<15000&&r.phase==='playing';tick++){
      while(i<c.rows.length-1&&r.y>c.rows[i].y+105)i++;
      const target=LANES[c.rows[i].safe];update(r,1/60,Math.abs(target-r.x)<5?0:Math.sign(target-r.x));
    }
    assert.equal(r.phase,'finished',`${name} seed ${seed}`);
  }
});

test('expert layouts mix trees, rocks, and fewer fences without crowding every lane',()=>{
  const counts={tree:0,rock:0,'rock-small':0,fence:0};let total=0;
  for(let seed=1;seed<=80;seed++){
    const c=createCourse('expert',seed);
    for(const e of c.entities)if(Object.hasOwn(counts,e.kind)){counts[e.kind]++;total++}
  }
  const average=total/80/(LEVELS.expert.length/18000);
  assert.ok(average>=150 && average<=220,`unexpected expert obstacle count: ${average}`);
  assert.ok(counts.fence<total*.4,'fences should not dominate the course');
  assert.ok(counts.tree>total*.15 && counts.rock>total*.15,'trees and rocks should both appear regularly');
});

test('pause freezes a run and resume continues it without changing terminal states',()=>{
  const run=start(newRun('beginner',course()));
  update(run,.05,1);pause(run);
  const frozen={x:run.x,y:run.y,time:run.time,score:run.score};
  update(run,.05,-1);assert.deepEqual({x:run.x,y:run.y,time:run.time,score:run.score},frozen);
  resume(run);update(run,.05,0);assert.ok(run.y>frozen.y);assert.ok(run.score>frozen.score);
  run.phase='crashed';pause(run);resume(run);assert.equal(run.phase,'crashed');
});

test('tricks require airtime, finish once, and score on a safe landing',()=>{
  for(const [name,bonus] of [['180',100],['360',200],['720',400],['frontflip',250],['backflip',250]]){
    const run=start(newRun('expert',course()));
    assert.equal(performTrick(run,name),false);
    run.airTime=1;run.airDuration=1;run.airKind='large';
    assert.equal(performTrick(run,name),true);assert.equal(performTrick(run,name),false);
    ride(run,.7);assert.ok(run.airTime>0);assert.ok(run.score<bonus);
    ride(run,.35);assert.equal(run.airTime,0);assert.ok(run.score>=bonus);
    const after=run.score;update(run,.05,0);assert.ok(run.score-after<1);
  }
});
test('tricks cannot start too late or during pause and do not score on a crash',()=>{
  const run=start(newRun('expert',course([{id:1,kind:'tree',x:360,y:20,halfWidth:27,halfHeight:27}])));
  run.airTime=.1;run.airDuration=1;run.airKind='small';
  assert.equal(performTrick(run,'720'),false);
  pause(run);assert.equal(performTrick(run,'180'),false);resume(run);
  run.airTime=1;assert.equal(performTrick(run,'180'),true);
  update(run,.05,0);assert.equal(run.phase,'crashed');assert.equal(run.trick,null);assert.ok(run.score<100);
});
