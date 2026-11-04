import {createCourse, WIDTH, SMALL_AIRTIME, LARGE_AIRTIME} from './course.mjs';
export const RIDER_RADIUS=12;
export const MAX_MULTIPLIER=5;
const STEER_SPEED=310;
export function newRun(difficulty='beginner',course=createCourse(difficulty)){
  return {difficulty,course,x:WIDTH/2,y:0,time:0,score:0,multiplier:1,
    speed:course.initialSpeed,phase:'ready',tilt:0,airTime:0,airDuration:0,airKind:null,
    encountered:new Set(),closest:new Map(),cue:null,cueTime:0};
}
export function start(run){if(run.phase==='ready')run.phase='playing';return run}
function pointSegmentDistance(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len)):0;return Math.hypot(px-(ax+t*dx),py-(ay+t*dy))}
function hitsRect(ax,ay,bx,by,left,right,top,bottom){let enter=0,exit=1;for(const [p,d,min,max] of [[ax,bx-ax,left,right],[ay,by-ay,top,bottom]]){if(Math.abs(d)<1e-8){if(p<min||p>max)return false}else{let a=(min-p)/d,b=(max-p)/d;if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);exit=Math.min(exit,b);if(enter>exit)return false}}return true}
function distanceToEntity(e,ax,ay,bx,by){
  if(e.kind==='fence'){
    if(hitsRect(ax,ay,bx,by,e.x-e.halfWidth-RIDER_RADIUS,e.x+e.halfWidth+RIDER_RADIUS,e.y-e.halfHeight-RIDER_RADIUS,e.y+e.halfHeight+RIDER_RADIUS))return 0;
    const dx=Math.max(0,Math.abs(bx-e.x)-e.halfWidth),dy=Math.max(0,Math.abs(by-e.y)-e.halfHeight);return Math.hypot(dx,dy);
  }
  return pointSegmentDistance(e.x,e.y,ax,ay,bx,by)-e.halfWidth;
}
function reward(run,amount,label){run.multiplier=Math.min(MAX_MULTIPLIER,Math.round((run.multiplier+amount)*100)/100);run.cue=label;run.cueTime=1.5}
export function canClear(airKind,obstacleKind){
  return airKind==='large'&&['tree','rock','rock-small','fence'].includes(obstacleKind)
    || airKind==='small'&&['rock-small','fence'].includes(obstacleKind);
}
export function update(run,delta,direction){
  if(run.phase!=='playing')return run;
  const dt=Math.max(0,Math.min(delta,.05)),steer=Math.max(-1,Math.min(1,direction||0)),oldX=run.x,oldY=run.y;
  run.time+=dt;run.speed=Math.min(run.course.maxSpeed,run.speed+run.course.acceleration*dt);
  run.x=Math.max(RIDER_RADIUS,Math.min(WIDTH-RIDER_RADIUS,run.x+steer*STEER_SPEED*dt));run.y=Math.min(run.course.length,run.y+run.speed*dt);
  run.tilt+=(steer*.28-run.tilt)*Math.min(1,dt*10);
  run.airTime=Math.max(0,run.airTime-dt);if(!run.airTime)run.airKind=null;
  run.cueTime=Math.max(0,run.cueTime-dt);run.score+=dt*15*run.multiplier;
  for(const e of run.course.entities){
    if(e.y<oldY-110||e.y>run.y+110||run.encountered.has(e.id))continue;
    if(e.kind.startsWith('ramp')){
      const triggered=hitsRect(oldX,oldY,run.x,run.y,e.x-e.halfWidth-RIDER_RADIUS,e.x+e.halfWidth+RIDER_RADIUS,e.y-e.halfHeight-RIDER_RADIUS,e.y+e.halfHeight+RIDER_RADIUS);
      if(triggered){run.encountered.add(e.id);const large=e.kind==='ramp-large';run.airKind=large?'large':'small';run.airDuration=large?LARGE_AIRTIME:SMALL_AIRTIME;run.airTime=run.airDuration;reward(run,large?.5:.25,large?'BIG AIR  +0.50×':'AIRTIME  +0.25×')}
      continue;
    }
    const clearance=distanceToEntity(e,oldX,oldY,run.x,run.y);
    run.closest.set(e.id,Math.min(run.closest.get(e.id)??Infinity,clearance));
    if(clearance<=RIDER_RADIUS){
      if(run.airTime>0&&canClear(run.airKind,e.kind)){run.encountered.add(e.id);run.closest.delete(e.id);run.cue='CLEARED!';run.cueTime=1;continue}
      run.phase='crashed';run.cue=null;return run;
    }
    if(run.y>e.y+e.halfHeight+RIDER_RADIUS){if(run.closest.get(e.id)<=RIDER_RADIUS+24)reward(run,.25,'CLOSE CALL  +0.25×');run.closest.delete(e.id);run.encountered.add(e.id)}
  }
  if(run.y>=run.course.length)run.phase='finished';return run;
}
export function formatTime(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}.${String(Math.floor((t%1)*100)).padStart(2,'0')}`}
