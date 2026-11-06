// World coordinates use 10 units per displayed metre. A seeded layout makes
// random runs reproducible while keeping records in the same coordinate space.
export const WIDTH = 720;
export const PIPE_LEFT=95;
export const PIPE_RIGHT=WIDTH-PIPE_LEFT;
export const UNITS_PER_METRE = 10;
export const LEVELS = {
  beginner: {label:'Beginner',length:10500,initialSpeed:200,maxSpeed:200,acceleration:0,gap:250,seed:11},
  intermediate: {label:'Intermediate',length:26250,initialSpeed:185,maxSpeed:260,acceleration:3.6,gap:205,seed:29},
  expert: {label:'Expert',length:45000,initialSpeed:270,maxSpeed:340,acceleration:2.8,gap:190,seed:47},
};
export const LANES=[75,188,301,419,532,645];
export const MIN_RAMP_SPACING=650;
export const SMALL_AIRTIME=.95;
export const LARGE_AIRTIME=1.2;
function randomSource(seed) {
  let n=seed>>>0;
  return ()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};
}
function safeLane(row){const s=Math.floor(row/5)%10;return s<5?s:9-s;}
function chooseLane(available,rnd){
  // Weight central lanes, without filling the protected path.
  const weighted=available.flatMap(i=>Array(i>=1&&i<=4?3:1).fill(i));
  return weighted[Math.floor(rnd()*weighted.length)];
}
function makeEntity(id,kind,x,y,extra={}){
  const sizes={tree:[27,27],rock:[24,20],'rock-small':[15,13],fence:[41,10],'ramp-small':[28,22],'ramp-large':[39,27]};
  const [halfWidth,halfHeight]=sizes[kind];return {id,kind,x,y,halfWidth,halfHeight,...extra};
}
// Practice is streamed in finite downhill-sized segments so the course can
// continue indefinitely without retaining every obstacle from the entire run.
function practiceCourse(course){return {...course,mode:'practice',endless:true,segmentIndex:0,generatedUntil:course.length}}
export function extendPracticeCourse(course,position,encountered,closest){
  if(!course.endless)return;
  while(position+5000>=course.generatedUntil){
    const index=++course.segmentIndex,offset=course.generatedUntil;
    const seed=(course.seed+Math.imul(index,0x9e3779b9))>>>0;
    const segment=createCourse(course.difficulty,seed,'downhill');
    const id=value=>`segment-${index}-${value}`;
    for(const entity of segment.entities){
      const copy={...entity,id:id(entity.id),y:entity.y+offset};
      if(entity.pairedRampId!==undefined)copy.pairedRampId=id(entity.pairedRampId);
      if(entity.pairedObstacleId!==undefined)copy.pairedObstacleId=id(entity.pairedObstacleId);
      course.entities.push(copy);
    }
    course.generatedUntil+=segment.length;
    const keepFrom=Math.max(0,offset-segment.length);
    course.entities=course.entities.filter(entity=>{
      if(entity.y>=keepFrom)return true;
      encountered.delete(entity.id);closest.delete(entity.id);return false;
    });
  }
}
export function createCourse(difficulty,seedOverride,mode='downhill'){
  const level=LEVELS[difficulty];if(!level)throw new Error(`Unknown difficulty: ${difficulty}`);
  const seed=Number.isFinite(seedOverride)?seedOverride>>>0:level.seed,rnd=randomSource(seed),entities=[],rows=[];
  const add=(kind,x,y,extra)=>{const entity=makeEntity(entities.length,kind,x,y,extra);entities.push(entity);return entity};
  if(mode==='halfpipe')return {difficulty,...level,mode,seed,width:WIDTH,length:LEVELS.beginner.length,initialSpeed:200,maxSpeed:200,acceleration:0,rows,entities};
  if(mode==='ramps'){
    const rampLanes=[...LANES.slice(0,3),WIDTH/2,...LANES.slice(3)];
    for(let y=550,row=0;y<level.length-200;y+=550,row++){
      for(let lane=0;lane<rampLanes.length;lane++)add((row+lane)%3===0?'ramp-large':'ramp-small',rampLanes[lane],y,{row});
    }
    return {difficulty,...level,mode,seed,width:WIDTH,rows,entities};
  }
  if(mode==='practice')return practiceCourse(createCourse(difficulty,seed,'downhill'));
  if(mode!=='downhill')throw new Error(`Unknown mode: ${mode}`);
  // Keep the familiar beginner course stable, including existing run markers.
  if(difficulty==='beginner'){
    let row=0;
    for(let y=550;y<level.length-300;){
      const safe=safeLane(row),available=LANES.map((_,i)=>i).filter(i=>i!==safe);
      const lane=available[Math.floor(rnd()*available.length)],x=LANES[lane]+(rnd()-.5)*18;
      rows.push({y,safe});add('tree',x,y,{row});row++;
      y+=level.gap+Math.floor(rnd()*38);
    }
    return {difficulty,...level,seed,width:WIDTH,rows,entities};
  }
  let nextRamp=700+rnd()*650,row=0,reserved=[];
  for(let y=550;y<level.length-350;){
    const progress=y/level.length,safe=safeLane(row);rows.push({y,safe});
    // The first row after a lane change also leaves the old lane open,
    // giving the rider time to transition even at top speed.
    const previous=row>0&&row%5===0?safeLane(row-1):-1;
    let candidates=LANES.map((_,i)=>i).filter(i=>i!==safe&&i!==previous);
    reserved=reserved.filter(z=>z.until>=y-60);
    // Obstacles can be placed up to 19 units either side of their row center.
    const usable=i=>!reserved.some(z=>Math.abs(LANES[i]-z.x)<100 && y+19>=z.from && y-19<=z.until);
    const available=()=>candidates.filter(usable);
    const remove=i=>{candidates=candidates.filter(x=>x!==i)};
    let rampMade=false;
    if(y>=nextRamp && y<level.length-850 && available().length && rnd()<.7){
      const lane=chooseLane(available(),rnd),x=LANES[lane]+(rnd()-.5)*16;
      const large=difficulty==='expert'&&rnd()<.48;
      const kind=large?'ramp-large':'ramp-small';
      const ramp=add(kind,x,y,{row});remove(lane);
      const possibilities=large?['tree','rock','rock-small','fence']:['rock-small','fence'];
      const target=possibilities[Math.floor(rnd()*possibilities.length)];
      const paired=add(target,x,y+(large?135:78),{row,pairedRampId:ramp.id});ramp.pairedObstacleId=paired.id;
      // Keep the jump lane clear through the latest possible landing, so the
      // paired obstacle cannot cause a wipeout as a well-aligned jump ends.
      const airtime=large?LARGE_AIRTIME:SMALL_AIRTIME;
      reserved.push({x,from:y-70,until:y+level.maxSpeed*airtime+(difficulty==='expert'?220:100)});
      nextRamp=y+MIN_RAMP_SPACING+rnd()*500;rampMade=true;
    }
    let count;
    if(difficulty==='intermediate') count=rnd()<.75?2:1;
    else {
      // More breathing room overall, with a gradual increase farther downhill.
      const density=rnd();
      count=density<.18-progress*.08?1:density<.91-progress*.12?2:3;
    }
    // A ramp itself is one feature in the row, while the jump target sits ahead.
    if(rampMade)count=Math.max(0,count-1);
    for(let n=0;n<count && available().length;n++){
      const lane=chooseLane(available(),rnd),x=LANES[lane]+(rnd()-.5)*20;remove(lane);
      let kind='tree';
      if(difficulty==='intermediate'){const p=rnd();kind=p<.39?'tree':p<.73?'rock':'fence';}
      if(difficulty==='expert'){const p=rnd();kind=p<.28?'tree':p<.56?'rock':p<.72?'rock-small':'fence';}
      add(kind,x,y+(rnd()-.5)*38,{row});
    }
    row++;
    y+=level.gap+(rnd()-.5)*55-(difficulty==='expert'?progress*28:0);
  }
  return {difficulty,...level,seed,width:WIDTH,rows,entities:entities.sort((a,b)=>a.y-b.y)};
}
