import {createCourse, extendPracticeCourse, WIDTH, PIPE_LEFT, PIPE_RIGHT, SMALL_AIRTIME, LARGE_AIRTIME} from './course.mjs';
export const RIDER_RADIUS=12;
const STEER_SPEED=310;
export const PRACTICE_RECOVERY_SECONDS=1.2;
export const TRICKS={
  '180':{label:'180',duration:.22,points:100,turns:.5},
  '360':{label:'360',duration:.34,points:200,turns:1},
  '720':{label:'720',duration:.55,points:400,turns:2},
  frontflip:{label:'FRONT FLIP',duration:.4,points:250,flip:1},
  backflip:{label:'BACKFLIP',duration:.4,points:250,flip:-1},
};
// Tricks run sequentially and are scored only after a safe landing.
export function performTrick(run,name){
  const trick=Object.hasOwn(TRICKS,name)?TRICKS[name]:null;
  if(run.phase!=='playing'||!trick||run.airTime<=0)return false;
  if(run.trick&&!run.trick.complete){run.cue='FINISH CURRENT TRICK';run.cueTime=1;return false}
  const capacity=run.airKind==='large'?2:1;
  if(run.trickCount>=capacity){run.cue='TRICK LIMIT REACHED';run.cueTime=1;return false}
  if(run.airTime+1e-9<trick.duration){run.cue='NOT ENOUGH AIRTIME';run.cueTime=1;return false}
  run.trick={name,elapsed:0,complete:false};run.trickCount++;run.cue=trick.label+(capacity===2?` · ${run.trickCount}/2`:'');run.cueTime=1;
  return true;
}
export function newRun(difficulty='beginner',course=createCourse(difficulty)){
  return {difficulty,course,x:WIDTH/2,y:0,time:0,score:0,multiplier:1,
    speed:course.initialSpeed,phase:'ready',tilt:0,airTime:0,airDuration:0,airKind:null,
    encountered:new Set(),closest:new Map(),cue:null,cueTime:0,trick:null,trickCount:0,completedTricks:[],pipeDirection:1,recoveryTime:0};
}
export function start(run){if(run.phase==='ready')run.phase='playing';return run}
export function pause(run){if(run.phase==='playing')run.phase='paused';return run}
export function resume(run){if(run.phase==='paused')run.phase='playing';return run}
export function endPractice(run){if(run.course.endless&&run.course.mode==='practice'&&['playing','paused'].includes(run.phase)){run.phase='finished';run.recoveryTime=0;run.airTime=0;run.airKind=null;run.trick=null;run.trickCount=0;run.completedTricks=[];run.cue=null;run.cueTime=0}return run}
function pointSegmentDistance(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len)):0;return Math.hypot(px-(ax+t*dx),py-(ay+t*dy))}
function hitsRect(ax,ay,bx,by,left,right,top,bottom){let enter=0,exit=1;for(const [p,d,min,max] of [[ax,bx-ax,left,right],[ay,by-ay,top,bottom]]){if(Math.abs(d)<1e-8){if(p<min||p>max)return false}else{let a=(min-p)/d,b=(max-p)/d;if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);exit=Math.min(exit,b);if(enter>exit)return false}}return true}
function distanceToEntity(e,ax,ay,bx,by){
  if(e.kind==='fence'){
    if(hitsRect(ax,ay,bx,by,e.x-e.halfWidth-RIDER_RADIUS,e.x+e.halfWidth+RIDER_RADIUS,e.y-e.halfHeight-RIDER_RADIUS,e.y+e.halfHeight+RIDER_RADIUS))return 0;
    const dx=Math.max(0,Math.abs(bx-e.x)-e.halfWidth),dy=Math.max(0,Math.abs(by-e.y)-e.halfHeight);return Math.hypot(dx,dy);
  }
  return pointSegmentDistance(e.x,e.y,ax,ay,bx,by)-e.halfWidth;
}
function reward(run,amount,label){run.multiplier=Math.round((run.multiplier+amount)*100)/100;run.cue=label;run.cueTime=1.5}
export function canClear(airKind,obstacleKind){
  return airKind==='large'&&['tree','rock','rock-small','fence'].includes(obstacleKind)
    || airKind==='small'&&['rock-small','fence'].includes(obstacleKind);
}
function advanceAir(run,dt){
  if(run.trick&&!run.trick.complete){
    const duration=TRICKS[run.trick.name].duration;
    run.trick.elapsed=Math.min(duration,run.trick.elapsed+dt);
    if(run.trick.elapsed+1e-9>=duration){run.trick.elapsed=duration;run.trick.complete=true;run.completedTricks.push(run.trick.name)}
  }
  const wasAirborne=run.airTime>0;run.airTime=Math.max(0,run.airTime-dt);
  const landed=wasAirborne&&!run.airTime,completed=landed?run.completedTricks:[];
  if(landed){run.trick=null;run.airKind=null;run.trickCount=0;run.completedTricks=[]}
  return {landed,tricks:completed};
}
function scoreTricks(run,names){if(names.length){const points=names.reduce((sum,name)=>sum+Math.round(TRICKS[name].points*run.multiplier),0);run.score+=points;run.cue=names.map(name=>TRICKS[name].label).join(' + ')+'  +'+points;run.cueTime=1.5}}
function updateHalfpipe(run,dt,steer){
  run.time+=dt;run.y=Math.min(run.course.length,run.y+run.speed*dt);run.score+=dt*15*run.multiplier;run.cueTime=Math.max(0,run.cueTime-dt);
  const air=advanceAir(run,dt);
  if(air.landed){run.pipeDirection*=-1;run.x=run.pipeDirection>0?PIPE_LEFT+20:PIPE_RIGHT-20;scoreTricks(run,air.tricks)}
  if(!run.airTime&&!air.landed){
    // Directional input adds or reduces lateral speed without trapping the rider.
    const lateral=240+steer*run.pipeDirection*70;
    run.x=Math.max(PIPE_LEFT,Math.min(PIPE_RIGHT,run.x+run.pipeDirection*lateral*dt));
    if(run.x===PIPE_LEFT||run.x===PIPE_RIGHT){run.airKind='large';run.airDuration=LARGE_AIRTIME;run.airTime=LARGE_AIRTIME;run.trick=null;run.trickCount=0;run.completedTricks=[];reward(run,.25,'LIP AIR  +0.25×')}
  }
  run.tilt+=(run.pipeDirection*.23-run.tilt)*Math.min(1,dt*10);
  if(run.y>=run.course.length&&!run.airTime)run.phase='finished';
  return run;
}
export function update(run,delta,direction){
  if(run.phase!=='playing')return run;
  const dt=Math.max(0,Math.min(delta,.05)),steer=Math.max(-1,Math.min(1,direction||0)),oldX=run.x,oldY=run.y;
  if(run.recoveryTime>0){
    run.time+=dt;run.recoveryTime=Math.max(0,run.recoveryTime-dt);
    if(run.recoveryTime<1e-8)run.recoveryTime=0;
    run.cueTime=run.recoveryTime;
    return run;
  }
  if(run.course.mode==='halfpipe')return updateHalfpipe(run,dt,steer);
  if(run.course.endless)extendPracticeCourse(run.course,run.y,run.encountered,run.closest);
  run.time+=dt;run.speed=Math.min(run.course.maxSpeed,run.speed+run.course.acceleration*dt);
  run.x=Math.max(RIDER_RADIUS,Math.min(WIDTH-RIDER_RADIUS,run.x+steer*STEER_SPEED*dt));run.y=run.course.endless?run.y+run.speed*dt:Math.min(run.course.length,run.y+run.speed*dt);
  run.tilt+=(steer*.28-run.tilt)*Math.min(1,dt*10);
  run.cueTime=Math.max(0,run.cueTime-dt);run.score+=dt*15*run.multiplier;
  const air=advanceAir(run,dt);
  for(const e of run.course.entities){
    if(e.y<oldY-110||e.y>run.y+110||run.encountered.has(e.id))continue;
    if(e.kind.startsWith('ramp')){
      const triggered=hitsRect(oldX,oldY,run.x,run.y,e.x-e.halfWidth-RIDER_RADIUS,e.x+e.halfWidth+RIDER_RADIUS,e.y-e.halfHeight-RIDER_RADIUS,e.y+e.halfHeight+RIDER_RADIUS);
      if(triggered){
        // A ramp touched during a jump or on its landing is already passed;
        // otherwise overlapping ramps can immediately launch the same jump again.
        if(run.course.mode==='ramps'&&(run.airTime>0||air.landed)){run.encountered.add(e.id);continue}
        run.encountered.add(e.id);const large=e.kind==='ramp-large';run.airKind=large?'large':'small';run.airDuration=large?LARGE_AIRTIME:SMALL_AIRTIME;run.airTime=run.airDuration;run.trick=null;run.trickCount=0;run.completedTricks=[];reward(run,large?.5:.25,large?'BIG AIR  +0.50×':'AIRTIME  +0.25×')
      }
      continue;
    }
    const clearance=distanceToEntity(e,oldX,oldY,run.x,run.y);
    run.closest.set(e.id,Math.min(run.closest.get(e.id)??Infinity,clearance));
    if(clearance<=RIDER_RADIUS){
      if(run.airTime>0&&canClear(run.airKind,e.kind)){run.encountered.add(e.id);run.closest.delete(e.id);run.cue='CLEARED!';run.cueTime=1;continue}
      if(run.course.mode==='practice'){
        // The course only moves downhill, so the struck obstacle is behind the
        // rider after recovery; ignoring it cannot mask another obstacle.
        run.encountered.add(e.id);run.closest.delete(e.id);run.recoveryTime=PRACTICE_RECOVERY_SECONDS;
        run.score=0;run.multiplier=1;run.trick=null;run.trickCount=0;run.completedTricks=[];run.airTime=0;run.airKind=null;run.airDuration=0;
        run.cue='FALL · GETTING UP';run.cueTime=run.recoveryTime;return run;
      }
      run.phase='crashed';run.trick=null;run.trickCount=0;run.completedTricks=[];run.cue=null;return run;
    }
    if(run.y>e.y+e.halfHeight+RIDER_RADIUS){if(run.closest.get(e.id)<=RIDER_RADIUS+24)reward(run,.25,'CLOSE CALL  +0.25×');run.closest.delete(e.id);run.encountered.add(e.id)}
  }
  scoreTricks(run,air.tricks);
  if(!run.course.endless&&run.y>=run.course.length)run.phase='finished';return run;
}
export function formatTime(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}.${String(Math.floor((t%1)*100)).padStart(2,'0')}`}
