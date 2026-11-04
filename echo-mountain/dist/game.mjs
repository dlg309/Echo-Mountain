import {createCourse, UNITS_PER_METRE} from './course.mjs';
import {newRun,start,update,formatTime} from './engine.mjs';
import {loadRecords,saveRun,validRecord} from './records.mjs';
import {render} from './renderer.mjs';
const $=selector=>document.querySelector(selector);
const canvas=$('#game'),ctx=canvas.getContext('2d'),overlay=$('#overlay'),content=$('#overlay-content');
const difficulty=$('#difficulty'),lighting=$('#lighting'),fog=$('#fog'),keys=new Set();
const memory=new Map();let persistent=true,backing;
try {backing=window.localStorage;const probe='echo-storage-test';backing.setItem(probe,'1');backing.removeItem(probe)} catch {persistent=false}
const storage={getItem(key){if(memory.has(key))return memory.get(key);try{return backing?.getItem(key)??null}catch{persistent=false;return null}},setItem(key,value){memory.set(key,value);try{backing?.setItem(key,value)}catch{persistent=false}}};
let records=loadRecords(storage),run=newRun(),last=0,lastHUD=0,touch=0,shown=false,needsRender=true;
const descriptions={
  beginner:{title:'First Tracks',copy:'An easygoing descent through the trees. Find your line and make it to the finish.'},
  intermediate:{title:'Pine Ridge',copy:'Dodge obstacles and use small ramps to clear small rocks or fences.'},
  expert:{title:'Summit Run',copy:'Small ramps clear small rocks and fences. Big ramps can clear trees and larger rocks too.'},
};
const lights={day:['☼','BLUEBIRD DAY','CLEAR SKIES · FRESH SNOW'],sunrise:['☼','SUNRISE','FIRST LIGHT ON THE MOUNTAIN'],sunset:['◒','SUNSET','GOLDEN HOUR ON THE SLOPES'],night:['☾','NIGHT RIDE','AFTER DARK · MOONLIT SNOW']};
function meters(value){return Math.round(value/UNITS_PER_METRE)}
function syncRecords(){const r=records[run.difficulty]||{};$('#record-level').textContent=run.difficulty.toUpperCase();$('#last-record').textContent=validRecord(r.last,run.course)?`${meters(r.last.distance)} M`:'—';$('#best-record').textContent=validRecord(r.best,run.course)?`${meters(r.best.distance)} M`:'—';$('#storage-note').textContent=persistent?'Markers are saved in this browser. Intermediate and expert courses reshuffle each run; markers retain their positions.':'Run markers are available for this session only because browser storage is unavailable.'}
function syncStats(){const percent=Math.min(100,Math.floor(run.y/run.course.length*100));$('#score').textContent=Math.floor(run.score).toLocaleString();$('#multiplier').textContent=run.multiplier.toFixed(2)+'×';$('#speed').textContent=run.phase==='playing'?Math.round(run.speed/UNITS_PER_METRE*3.6):0;$('#time').textContent=formatTime(run.time);$('#distance').textContent=meters(run.y);$('#length').textContent=meters(run.course.length).toLocaleString();$('#percent').textContent=percent+'%';$('#progress').style.width=percent+'%';const cue=$('#cue');const value=run.cueTime>0?run.cue:'';if(cue.textContent!==value)cue.textContent=value;cue.classList.toggle('visible',Boolean(value))}
function syncSelection(){const d=descriptions[run.difficulty];$('#trail-name').textContent=d.title;$('#level-badge').textContent='●  '+run.difficulty.toUpperCase();$('#fog-setting').hidden=run.difficulty!=='expert';syncRecords();syncStats()}
function ready(){needsRender=true;shown=false;last=0;keys.clear();touch=0;overlay.classList.remove('hidden');const d=descriptions[run.difficulty];content.innerHTML=`<small>${run.difficulty.toUpperCase()} · ${meters(run.course.length).toLocaleString()} METERS</small><h2>Ready to ride?</h2><p>${d.copy} A crash ends your run, so choose your line carefully.</p><button id="start" class="primary">DROP IN <span>↗</span></button><div class="hint"><kbd>←</kbd><kbd>→</kbd> OR <kbd>A</kbd><kbd>D</kbd> TO STEER<br>${run.difficulty==='expert'?'Try the fog switch above.':'Change difficulty or time of day above.'}</div>`;$('#start').addEventListener('click',begin);syncSelection()}
function begin(){needsRender=true;const seed=difficulty.value==='beginner'?undefined:Math.floor(Math.random()*4294967296);run=newRun(difficulty.value,createCourse(difficulty.value,seed));start(run);shown=false;last=0;keys.clear();touch=0;overlay.classList.add('hidden');canvas.focus({preventScroll:true});document.querySelector('.shell').scrollIntoView({behavior:'smooth',block:'start'});syncStats()}
function result(){needsRender=true;shown=true;records=saveRun(storage,run);syncRecords();overlay.classList.remove('hidden');const win=run.phase==='finished';content.innerHTML=`<small>${win?'FINISH LINE CROSSED':'YOUR RUN ENDED'}</small><h2>${win?'Nice lines.':'Wipeout!'}</h2><p>${win?'You made it all the way down the mountain.':'You hit an obstacle. Your run marker is waiting on your next descent.'}</p><div class="result-stats"><div><small>DISTANCE</small>${meters(run.y).toLocaleString()} m</div><div><small>SCORE</small>${Math.floor(run.score).toLocaleString()}</div><div><small>TIME</small>${formatTime(run.time)}</div></div><button id="again" class="primary">RIDE AGAIN <span>↗</span></button><div class="hint">Change difficulty or lighting above.</div>`;$('#again').addEventListener('click',begin);$('#again').focus()}
difficulty.addEventListener('change',()=>{run=newRun(difficulty.value);ready()});
fog.addEventListener('change',()=>{$('#fog-status').textContent=fog.checked?'On':'Off';needsRender=true;if(run.phase==='playing')canvas.focus({preventScroll:true})});
lighting.addEventListener('change',()=>{const [icon,name,caption]=lights[lighting.value];$('#light-icon').textContent=icon;$('#light-name').textContent=name;$('#light-caption').textContent=caption;needsRender=true;if(run.phase==='playing')canvas.focus()});
addEventListener('keydown',e=>{if(run.phase!=='playing'||['INPUT','SELECT','BUTTON'].includes(e.target?.tagName))return;if(['arrowleft','arrowright','a','d'].includes(e.key.toLowerCase())){e.preventDefault();keys.add(e.key.toLowerCase())}});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>{keys.clear();touch=0;last=0});document.addEventListener('visibilitychange',()=>{last=0;keys.clear();touch=0});
for(const [id,dir] of [['left',-1],['right',1]]){const b=$('#'+id);b.addEventListener('pointerdown',e=>{e.preventDefault();touch=dir;b.setPointerCapture(e.pointerId);canvas.focus()});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{if(touch===dir)touch=0})}
function resize(){const rect=canvas.getBoundingClientRect();if(rect.width&&rect.height){canvas.width=840;canvas.height=Math.max(250,Math.round(840*rect.height/rect.width));needsRender=true}}
new ResizeObserver(resize).observe(canvas);resize();ready();
function frame(ts){
  if(!last)last=ts;
  let delta=Math.max(0,Math.min((ts-last)/1000,.15));last=ts;
  const wasPlaying=run.phase==='playing';
  const direction=((keys.has('arrowright')||keys.has('d'))?1:0)-((keys.has('arrowleft')||keys.has('a'))?1:0)||touch;
  while(delta>0 && run.phase==='playing'){const step=Math.min(delta,.05);update(run,step,direction);delta-=step}
  if(['finished','crashed'].includes(run.phase)&&!shown)result();
  if(wasPlaying||needsRender){render(ctx,canvas,run,lighting.value,records[run.difficulty],fog.checked);needsRender=false}
  if((wasPlaying&&ts-lastHUD>=100)||(!wasPlaying&&ts-lastHUD>=1000)){syncStats();lastHUD=ts}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
