import {createCourse, UNITS_PER_METRE} from './course.mjs';
import {newRun,start,pause,resume,performTrick,update,formatTime} from './engine.mjs';
import {loadRecords,saveRun,validRecord} from './records.mjs';
import {render} from './renderer.mjs';
const $=selector=>document.querySelector(selector);
const canvas=$('#game'),ctx=canvas.getContext('2d'),overlay=$('#overlay'),content=$('#overlay-content');
const difficulty=$('#difficulty'),mode=$('#mode'),lighting=$('#lighting'),fog=$('#fog'),keys=new Set();
const memory=new Map();let persistent=true,backing;
try {backing=window.localStorage;const probe='echo-storage-test';backing.setItem(probe,'1');backing.removeItem(probe)} catch {persistent=false}
const storage={getItem(key){if(memory.has(key))return memory.get(key);try{return backing?.getItem(key)??null}catch{persistent=false;return null}},setItem(key,value){memory.set(key,value);try{backing?.setItem(key,value)}catch{persistent=false}}};
function recordStorage(){const suffix=mode.value==='downhill'?'':'-'+mode.value;return {getItem:key=>storage.getItem(key+suffix),setItem:(key,value)=>storage.setItem(key+suffix,value)}}
let records=loadRecords(recordStorage()),run=newRun(),last=0,lastHUD=0,touch=0,shown=false,needsRender=true,queuedTrick=null;
const trickKeys={z:'180',x:'360',c:'720',v:'frontflip',b:'backflip',g:'180',h:'360',j:'720',k:'frontflip',l:'backflip'};
const pauseButton=$('#pause'), motion=matchMedia('(prefers-reduced-motion: reduce)'),motionButton=$('#trick-motion');
let trickMotion=!motion.matches,motionOverridden=false;
function syncTrickMotion(){motionButton.setAttribute('aria-pressed',String(trickMotion));motionButton.textContent='Trick motion: '+(trickMotion?'On':'Off')}
motionButton.addEventListener('click',()=>{trickMotion=!trickMotion;motionOverridden=true;syncTrickMotion();needsRender=true});
syncTrickMotion();
const riderSprite=new Image();let spriteReady=false;
riderSprite.onload=()=>{spriteReady=true;needsRender=true};
riderSprite.src='assets/rider-flip-sheet-v2.png';
function clearSteering(){keys.clear();touch=0;queuedTrick=null}
function clearInput(){clearSteering();last=0}
function syncPause(){pauseButton.disabled=!['playing','paused'].includes(run.phase);pauseButton.textContent=run.phase==='paused'?'Resume · P / Esc':'Pause · P / Esc'}
const descriptions={
  beginner:{title:'First Tracks',copy:'An easygoing descent through the trees. Beginner has no ramps; choose Intermediate or Expert to try tricks.'},
  intermediate:{title:'Pine Ridge',copy:'Dodge obstacles and use small ramps to clear small rocks or fences.'},
  expert:{title:'Summit Run',copy:'Small ramps clear small rocks and fences. Big ramps can clear trees and larger rocks too.'},
};
const lights={day:['☼','BLUEBIRD DAY','CLEAR SKIES · FRESH SNOW'],sunrise:['☼','SUNRISE','FIRST LIGHT ON THE MOUNTAIN'],sunset:['◒','SUNSET','GOLDEN HOUR ON THE SLOPES'],twilight:['◒','TWILIGHT','LAST LIGHT · COOLING SNOW'],night:['☾','NIGHT RIDE','AFTER DARK · MOONLIT SNOW']};
function meters(value){return Math.round(value/UNITS_PER_METRE)}
function syncRecords(){const r=records[run.difficulty]||{};const name=run.course.mode==='halfpipe'?'HALFPIPE':run.course.mode==='ramps'?'TRICK RUN':run.course.mode==='practice'?'PRACTICE':'DOWNHILL';$('#record-level').textContent=name+' · '+run.difficulty.toUpperCase();$('#last-record').textContent=validRecord(r.last,run.course)?`${meters(r.last.distance)} M`:'—';$('#best-record').textContent=validRecord(r.best,run.course)?`${meters(r.best.distance)} M`:'—';$('#storage-note').textContent=persistent?'Markers are saved separately for each mode and difficulty in this browser. Downhill courses may reshuffle each run.':'Run markers are available for this session only because browser storage is unavailable.'}
function syncStats(){const percent=Math.min(100,Math.floor(run.y/run.course.length*100));$('#score').textContent=Math.floor(run.score).toLocaleString();$('#multiplier').textContent=run.multiplier.toFixed(2)+'×';$('#speed').textContent=['playing','paused'].includes(run.phase)&&!(run.recoveryTime>0)?Math.round(run.speed/UNITS_PER_METRE*3.6):0;$('#time').textContent=formatTime(run.time);$('#distance').textContent=meters(run.y);$('#length').textContent=meters(run.course.length).toLocaleString();$('#percent').textContent=percent+'%';$('#progress').style.width=percent+'%';const cue=$('#cue');const recovering=run.recoveryTime>0;const value=recovering?'FALL · GETTING UP':run.cueTime>0?run.cue:'';if(cue.textContent!==value)cue.textContent=value;cue.classList.toggle('visible',Boolean(value));cue.classList.toggle('recovering',recovering)}
function syncSelection(){const d=descriptions[run.difficulty];$('#trail-name').textContent=run.course.mode==='halfpipe'?'The Halfpipe':run.course.mode==='ramps'?'Trick Run':run.course.mode==='practice'?'Practice · '+d.title:d.title;$('#level-badge').textContent='●  '+run.difficulty.toUpperCase();$('#fog-setting').hidden=run.difficulty!=='expert';syncRecords();syncStats()}
function tutorial(){return '<div class="tutorial"><b>HOW TO RIDE</b><p>Steer with ← / → or A / D, or hold the touch buttons. Avoid obstacles and reach the finish. Ride over ramps to jump: small ramps clear small rocks and fences; big ramps can clear trees and larger rocks too. Downhill ramps appear on Intermediate and Expert. In Practice, a fall resets your score and multiplier; you get back up and continue. Trick Run has only ramps; in Halfpipe, the lips launch you across the pipe.</p><p>In the halfpipe, steering changes your speed across the pipe. While airborne, press Z / X / C / V / B (or G / H / J / K / L) for a 180 / 360 / 720 / front flip / backflip. Small ramps allow one trick; large ramps and halfpipe lips allow two. Finish the first before starting the next, with enough airtime left. Press again for the same trick. Land safely to score. Use Trick motion above to turn the animation on or off.</p><button id="dismiss-help" class="secondary" type="button">Got it</button></div>'}
function bindHelp(){const button=$('#dismiss-help');if(button)button.addEventListener('click',()=>{storage.setItem('echo-mountain-help-seen','1');button.parentElement.remove()})}
function ready(){needsRender=true;shown=false;clearInput();overlay.classList.remove('hidden');const d=descriptions[run.difficulty];const copy=run.course.mode==='halfpipe'?'Ride automatically between the lips. Press a trick key in the air; you will land back in the transition and head to the other side. Hold toward your direction of travel to speed up or the opposite direction to slow down.':run.course.mode==='ramps'?'A descent filled with ramps and no obstacles. Ride over them and land tricks for points.':run.course.mode==='practice'?d.copy+' A fall pauses your ride and resets your score and multiplier. Get back up and continue from the same spot.':d.copy+' A crash ends your run, so choose your line carefully.';content.innerHTML=`<small>${run.difficulty.toUpperCase()} · ${meters(run.course.length).toLocaleString()} METERS</small><h2>Ready to ride?</h2><p>${copy}</p>${storage.getItem('echo-mountain-help-seen')?'':tutorial()}<button id="start" class="primary">DROP IN <span>↗</span></button><div class="hint">SMALL RAMPS: 1 TRICK · LARGE RAMPS / PIPE: UP TO 2<br>P / ESC TO PAUSE · CHANGE SETTINGS ABOVE</div>`;bindHelp();$('#start').addEventListener('click',begin);syncSelection();syncPause()}
function begin(){storage.setItem('echo-mountain-help-seen','1');needsRender=true;const seed=difficulty.value==='beginner'?undefined:Math.floor(Math.random()*4294967296);run=newRun(difficulty.value,createCourse(difficulty.value,seed,mode.value));start(run);shown=false;clearInput();overlay.classList.add('hidden');syncPause();canvas.focus({preventScroll:true});document.querySelector('.shell').scrollIntoView({behavior:motion.matches?'auto':'smooth',block:'start'});syncStats()}
function showPaused(){pause(run);clearInput();needsRender=true;overlay.classList.remove('hidden');content.innerHTML='<small>TAKE A BREATHER</small><h2>Paused</h2><p>Your run is waiting right where you left it.</p><button id="resume" class="primary">RESUME RIDE <span>↗</span></button><button id="fresh" class="secondary" type="button">Start a fresh run</button><div class="hint">P / ESC TO RESUME</div>';$('#resume').addEventListener('click',resumeRide);$('#fresh').addEventListener('click',begin);syncPause();$('#resume').focus()}
function resumeRide(){resume(run);clearInput();overlay.classList.add('hidden');syncPause();canvas.focus({preventScroll:true})}
function togglePause(){if(run.phase==='playing')showPaused();else if(run.phase==='paused')resumeRide()}
function result(){needsRender=true;shown=true;const old=records[run.difficulty]?.best;const newBest=!old||!Number.isFinite(old.distance)||run.y>old.distance;records=saveRun(recordStorage(),run);syncRecords();syncPause();overlay.classList.remove('hidden');const win=run.phase==='finished';content.innerHTML=`<small>${win?'FINISH LINE CROSSED':'YOUR RUN ENDED'}</small><h2>${win?'Nice lines.':'Wipeout!'}</h2><p>${newBest?'New longest descent!': 'Your longest descent is '+meters(records[run.difficulty].best.distance).toLocaleString()+' m.'}</p><div class="result-stats"><div><small>DISTANCE</small>${meters(run.y).toLocaleString()} m</div><div><small>SCORE</small>${Math.floor(run.score).toLocaleString()}</div><div><small>TIME</small>${formatTime(run.time)}</div></div><button id="again" class="primary">RIDE AGAIN <span>↗</span></button><div class="hint">Change mode, difficulty or lighting above.</div>`;$('#again').addEventListener('click',begin);$('#again').focus()}
pauseButton.addEventListener('click',togglePause);
$('#help').addEventListener('click',()=>{if(run.phase==='playing')showPaused();if(!content.querySelector('.tutorial')){content.insertAdjacentHTML('beforeend',tutorial());bindHelp()}});
difficulty.addEventListener('change',()=>{run=newRun(difficulty.value,createCourse(difficulty.value,undefined,mode.value));ready()});
mode.addEventListener('change',()=>{records=loadRecords(recordStorage());run=newRun(difficulty.value,createCourse(difficulty.value,undefined,mode.value));ready()});
fog.addEventListener('change',()=>{$('#fog-status').textContent=fog.checked?'On':'Off';needsRender=true;if(run.phase==='playing')canvas.focus({preventScroll:true})});
lighting.addEventListener('change',()=>{const [icon,name,caption]=lights[lighting.value];document.querySelector('.mountain-stage').dataset.light=lighting.value;$('#light-icon').textContent=icon;$('#light-name').textContent=name;$('#light-caption').textContent=caption;needsRender=true;if(run.phase==='playing')canvas.focus()});
addEventListener('keydown',e=>{if((e.key.toLowerCase()==='p'||e.key==='Escape')&&!e.repeat&&!['INPUT','SELECT'].includes(e.target?.tagName)){if(['playing','paused'].includes(run.phase)){e.preventDefault();togglePause()}return}if(run.phase!=='playing'||['INPUT','SELECT'].includes(e.target?.tagName))return;const key=e.key.toLowerCase();if(run.recoveryTime>0){if(Object.hasOwn(trickKeys,key)||['arrowleft','arrowright','a','d'].includes(key))e.preventDefault();return}if(Object.hasOwn(trickKeys,key)){e.preventDefault();if(!e.repeat)requestTrick(trickKeys[key]);return}if(['arrowleft','arrowright','a','d'].includes(key)){e.preventDefault();if(!e.repeat)keys.add(key)}});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',clearInput);document.addEventListener('visibilitychange',clearInput);
for(const [id,dir] of [['left',-1],['right',1]]){const b=$('#'+id);b.addEventListener('pointerdown',e=>{e.preventDefault();if(run.phase!=='playing'||run.recoveryTime>0)return;touch=dir;b.setPointerCapture(e.pointerId);canvas.focus()});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{if(touch===dir)touch=0})}
function requestTrick(name){
  if(run.phase!=='playing'||run.recoveryTime>0)return;
  if(run.airTime>0){performTrick(run,name);syncStats();return}
  queuedTrick={name,until:performance.now()+500};run.cue=run.course.mode==='halfpipe'?'REACH A LIP TO TRICK':'HIT A RAMP TO TRICK';run.cueTime=1;
}
for(const button of document.querySelectorAll('[data-trick]')){
  button.addEventListener('pointerdown',e=>{e.preventDefault();requestTrick(button.dataset.trick)});
  button.addEventListener('click',e=>{if(e.detail===0)requestTrick(button.dataset.trick)});
}
function resize(){const rect=canvas.getBoundingClientRect();if(rect.width&&rect.height){canvas.width=840;canvas.height=Math.max(250,Math.round(840*rect.height/rect.width));needsRender=true}}
motion.addEventListener('change',()=>{if(!motionOverridden){trickMotion=!motion.matches;syncTrickMotion()}needsRender=true});
new ResizeObserver(resize).observe(canvas);resize();ready();
function frame(ts){
  if(!last)last=ts;
  let delta=Math.max(0,Math.min((ts-last)/1000,.15));last=ts;
  const wasPlaying=run.phase==='playing',wasRecovering=run.recoveryTime>0;
  const direction=((keys.has('arrowright')||keys.has('d'))?1:0)-((keys.has('arrowleft')||keys.has('a'))?1:0)||touch;
  while(delta>0 && run.phase==='playing'){const step=Math.min(delta,.05);update(run,step,direction);delta-=step}
  if(!wasRecovering&&run.recoveryTime>0){clearSteering();syncStats()}
  if(queuedTrick){if(ts>queuedTrick.until||run.phase!=='playing')queuedTrick=null;else if(run.airTime>0){performTrick(run,queuedTrick.name);queuedTrick=null}}
  if(['finished','crashed'].includes(run.phase)&&!shown)result();
  if(wasPlaying||needsRender){render(ctx,canvas,run,lighting.value,records[run.difficulty],fog.checked,{reducedMotion:motion.matches,trickMotion,sprite:spriteReady?riderSprite:null});needsRender=false}
  document.querySelector('.touch-tricks').classList.toggle('active',run.phase==='playing');
  if((wasPlaying&&ts-lastHUD>=100)||(!wasPlaying&&ts-lastHUD>=1000)){syncStats();lastHUD=ts}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
