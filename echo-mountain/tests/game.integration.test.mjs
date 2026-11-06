import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCourse} from '../dist/course.mjs';
import {newRun,start,update} from '../dist/engine.mjs';

test('game inputs reach the rider renderer after a ramp', async()=>{
  let clock=1000, nextFrame, resizeHandler, drawCalls=[];
  const events=new Map(), elements=new Map();
  const listen=(map,type,fn)=>{if(!map.has(type))map.set(type,[]);map.get(type).push(fn)};
  class Element {
    constructor(id){this.id=id;this.listeners=new Map();this.style={};this.dataset={};this.value='';this.hidden=false;this.textContent='';this.classList={add(){},remove(){},toggle(){}}}
    addEventListener(type,fn){listen(this.listeners,type,fn)}
    dispatch(type,extra={}){const e={target:this,preventDefault(){},...extra};for(const fn of this.listeners.get(type)||[])fn(e)}
    focus(){} scrollIntoView(){} setAttribute(){} setPointerCapture(){}
    getBoundingClientRect(){return this.rect||{width:570,height:700}}
    set innerHTML(value){this.html=value}
    get innerHTML(){return this.html}
    querySelector(selector){return selector==='.tutorial'&&this.html?.includes('class="tutorial"')?{}:null}
    insertAdjacentHTML(position,value){this.html=(this.html||'')+value}
  }
  const el=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
  const ctx=new Proxy({}, {get(obj,key){if(key==='createLinearGradient')return ()=>({addColorStop(){}});if(['drawImage','rotate','strokeText','translate'].includes(key))return (...args)=>drawCalls.push([key,...args]);return obj[key]??(()=>{})},set(obj,key,value){obj[key]=value;return true}});
  el('game').getContext=()=>ctx;
  el('difficulty').value='beginner';el('mode').value='downhill';el('lighting').value='day';el('fog').checked=true;
  const trickButtons=['180','360','720','frontflip','backflip'].map(name=>{const b=new Element(name);b.dataset.trick=name;return b});
  globalThis.document={querySelector(selector){return el(selector.replace(/^#/,''))},querySelectorAll(){return trickButtons},addEventListener(){}};
  globalThis.window=globalThis;
  const legacyRecord=JSON.stringify({
    beginner:{last:{distance:980,x:360},best:{distance:1190,x:360}},
    intermediate:{last:{distance:1230,x:360},best:{distance:1770,x:360}},
  });
  const saved=new Map([['echo-mountain-records-v1',legacyRecord]]);
  globalThis.localStorage={getItem(key){return saved.get(key)??null},setItem(key,value){saved.set(key,String(value))},removeItem(key){saved.delete(key)}};
  globalThis.addEventListener=(type,fn)=>listen(events,type,fn);
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>clock}});
  globalThis.requestAnimationFrame=fn=>{nextFrame=fn};
  globalThis.ResizeObserver=class{constructor(callback){resizeHandler=callback}observe(){}};
  globalThis.matchMedia=()=>({matches:false,addEventListener(){}});
  globalThis.Image=class{naturalWidth=400;set src(value){this.onload()}};
  const originalRandom=Math.random;Math.random=()=>0;
  try{
    await import('../dist/game.mjs');
    const dispatch=(type,key,repeat=false)=>{for(const fn of events.get(type)||[])fn({key,target:el('game'),preventDefault(){},repeat})};
    const tick=()=>{clock+=1000/60;const cb=nextFrame;assert.ok(cb,'game loop scheduled a frame');nextFrame=null;cb(clock)};
    assert.equal(el('last-record').textContent,'98 M','pre-existing downhill record loads without migration');
    assert.equal(el('best-record').textContent,'119 M','pre-existing downhill best loads without migration');
    el('lighting').value='golden';el('lighting').dispatch('change');
    assert.equal(el('light-name').textContent,'GOLDEN HOUR');
    assert.equal(el('.mountain-stage').dataset.light,'golden');
    el('lighting').value='twilight';el('lighting').dispatch('change');
    assert.equal(el('light-name').textContent,'TWILIGHT');
    assert.equal(el('.mountain-stage').dataset.light,'twilight');
    el('mode').value='ramps';el('mode').dispatch('change');assert.equal(el('trail-name').textContent,'Trick Run');assert.equal(el('last-record').textContent,'—');
    el('mode').value='halfpipe';el('mode').dispatch('change');assert.equal(el('trail-name').textContent,'The Halfpipe');assert.equal(el('last-record').textContent,'—');
    el('mode').value='downhill';el('mode').dispatch('change');assert.equal(el('last-record').textContent,'98 M');
    el('start').dispatch('click');for(let i=0;i<35;i++)tick();
    const beforeResize=Number(el('distance').textContent);
    assert.ok(beforeResize>0,'run is moving before resize');
    el('game').rect={width:400,height:620};resizeHandler();
    assert.ok(Math.abs(el('game').height/el('game').width-620/400)<.002,'backing canvas preserves aspect ratio');
    for(let i=0;i<20;i++)tick();
    assert.ok(Number(el('distance').textContent)>beforeResize,'resizing does not reset the active run');
    for(const [input,label] of [['z','180'],['x','360'],['c','720'],['v','FRONT FLIP'],['b','BACKFLIP'],['g','180'],['h','360'],['j','720'],['k','FRONT FLIP'],['l','BACKFLIP'],['touch','FRONT FLIP'],['queued','FRONT FLIP']]){
      el('difficulty').value='intermediate';el('difficulty').dispatch('change');el('start').dispatch('click');
      const model=start(newRun('intermediate',createCourse('intermediate',0)));let left=false,queued=false;tick();
      for(let i=0;i<450&&model.phase==='playing'&&!model.airTime;i++){
        const direction=model.y>815&&model.x>299?-1:0;
        if(direction&&!left){dispatch('keydown','ArrowLeft');left=true}
        if(!direction&&left){dispatch('keyup','ArrowLeft');left=false}
        if(input==='queued'&&model.y>920&&!queued){dispatch('keydown','v');queued=true}
        update(model,1/60,direction);tick();
      }
      if(left)dispatch('keyup','ArrowLeft');
      assert.ok(model.airTime>0,`${input}: model reached a ramp`);
      drawCalls=[];
      if(input==='touch')trickButtons[3].dispatch('pointerdown');else if(input!=='queued')dispatch('keydown',input);
      for(let i=0;i<12;i++)tick();
      if(!['touch','queued'].includes(input))dispatch('keyup',input);
      assert.ok(drawCalls.some(call=>call[0]==='strokeText'&&call[1]===label),`${input}: trick label was drawn`);
      const frames=new Set(drawCalls.filter(call=>call[0]==='drawImage').map(call=>`${call[2]},${call[3]}`));
      assert.ok(frames.size,`${input}: rider sprite was drawn`);
      if(['v','b','k','l','touch','queued'].includes(input))assert.ok(frames.size>1,`${input}: flip frames advanced`);
      else assert.ok(drawCalls.some(call=>call[0]==='rotate'&&Math.abs(call[1])>.5),`${input}: board rotated`);
    }
    // Check successive trick inputs on separate lip launches.
    const startHalfpipeJump=()=>{
      el('mode').value='halfpipe';el('mode').dispatch('change');el('start').dispatch('click');
      const model=start(newRun('intermediate',createCourse('intermediate',0,'halfpipe')));tick();
      for(let i=0;i<500&&!model.airTime;i++){update(model,1/60,0);tick()}
      assert.ok(model.airTime>0,'halfpipe rider reached the lip');
    };
    for(const input of ['arrow keys','A/D','same key','touch']){
      startHalfpipeJump();drawCalls=[];
      const first=input==='A/D'?'g':'z';
      if(input==='touch')trickButtons[0].dispatch('pointerdown',{pointerId:1});else dispatch('keydown',first);
      tick();assert.ok(drawCalls.some(call=>call[0]==='strokeText'&&call[1]==='180'),`${input}: first trick label`);
      for(let i=0;i<15;i++)tick();
      const previousAngle=drawCalls.filter(call=>call[0]==='rotate').at(-1)[1];drawCalls=[];
      if(input==='touch')trickButtons[1].dispatch('pointerdown',{pointerId:2});
      else {
        if(input==='arrow keys')dispatch('keydown',first,true); // A held key must not consume the next slot.
        dispatch('keyup',first);dispatch('keydown',input==='same key'?first:input==='A/D'?'h':'x');
      }
      for(let i=0;i<4;i++)tick();
      const secondLabel=input==='same key'?'180':'360';
      assert.ok(drawCalls.some(call=>call[0]==='strokeText'&&call[1]===secondLabel),`${input}: second trick label`);
      if(input==='same key')assert.ok(Math.abs(drawCalls.find(call=>call[0]==='rotate')[1]-previousAngle)>1,'release and repress starts the same trick again');
      if(input==='arrow keys'){
        for(let i=0;i<18;i++)tick();dispatch('keydown','z');for(let i=0;i<8;i++)tick();
        assert.equal(el('cue').textContent,'TRICK LIMIT REACHED','third-trick limit is visible');
      }
    }
    startHalfpipeJump();for(let i=0;i<56;i++)tick();dispatch('keydown','c');for(let i=0;i<8;i++)tick();
    assert.equal(el('cue').textContent,'NOT ENOUGH AIRTIME','late-trick feedback is visible');
    // Exercise a flip and finish the halfpipe run through the UI.
    el('mode').value='halfpipe';el('mode').dispatch('change');el('start').dispatch('click');
    const pipe=start(newRun('intermediate',createCourse('intermediate',0,'halfpipe')));tick();
    for(let i=0;i<500&&!pipe.airTime;i++){update(pipe,1/60,0);tick()}
    assert.ok(pipe.airTime>0,'halfpipe rider reached the lip');
    drawCalls=[];dispatch('keydown','v');for(let i=0;i<12;i++)tick();
    assert.ok(drawCalls.some(call=>call[0]==='strokeText'&&call[1]==='FRONT FLIP'),'halfpipe trick is shown');
    assert.ok(new Set(drawCalls.filter(call=>call[0]==='drawImage').map(call=>`${call[2]},${call[3]}`)).size>1,'halfpipe flip frames advance');
    for(let i=0;i<3600;i++)tick();
    assert.equal(el('last-record').textContent,'1050 M','halfpipe result is saved');
    el('help').dispatch('click');el('help').dispatch('click');
    assert.equal((el('overlay-content').html.match(/class="tutorial"/g)||[]).length,1,'help is not duplicated');
    el('mode').value='downhill';el('mode').dispatch('change');assert.equal(el('last-record').textContent,'123 M','halfpipe record does not replace downhill record');
    assert.equal(el('best-record').textContent,'177 M','halfpipe record does not replace downhill best');
    assert.equal(saved.get('echo-mountain-records-v1'),legacyRecord,'halfpipe never rewrites legacy downhill records');
    el('mode').value='halfpipe';el('mode').dispatch('change');assert.equal(el('last-record').textContent,'1050 M','halfpipe record is restored');
    el('mode').value='ramps';el('mode').dispatch('change');
    el('difficulty').value='beginner';el('difficulty').dispatch('change');el('start').dispatch('click');
    for(let i=0;i<3600;i++)tick();
    assert.equal(el('last-record').textContent,'1050 M','trick-run result is saved');
    assert.equal(saved.get('echo-mountain-records-v1'),legacyRecord,'trick run never rewrites legacy downhill records');
    el('difficulty').value='intermediate';el('difficulty').dispatch('change');assert.equal(el('last-record').textContent,'—','trick-run records are separate by difficulty');
    el('difficulty').value='beginner';el('difficulty').dispatch('change');assert.equal(el('last-record').textContent,'1050 M','trick-run record is restored');
    el('mode').value='downhill';el('mode').dispatch('change');assert.equal(el('last-record').textContent,'98 M','original beginner downhill record remains available');
    const startPracticeAndFall=()=>{
      el('mode').value='practice';el('mode').dispatch('change');
      assert.equal(el('trail-name').textContent,'Practice · First Tracks');
      el('start').dispatch('click');tick();dispatch('keydown','ArrowLeft');
      for(let i=0;i<12;i++)tick();dispatch('keyup','ArrowLeft');
      for(let i=0;i<250&&el('cue').textContent!=='FALL · GETTING UP';i++)tick();
      assert.equal(el('cue').textContent,'FALL · GETTING UP','practice fall is communicated');
      assert.equal(el('score').textContent,'0');assert.equal(el('multiplier').textContent,'1.00×');
    };
    startPracticeAndFall();
    el('pause').dispatch('click');const pausedTime=el('time').textContent,pausedDistance=el('distance').textContent;
    for(let i=0;i<90;i++)tick();
    assert.equal(el('time').textContent,pausedTime,'pausing recovery freezes time');
    assert.equal(el('distance').textContent,pausedDistance,'pausing recovery freezes position');
    el('resume').dispatch('click');drawCalls=[];tick();
    const before=drawCalls.filter(call=>call[0]==='translate').at(-1)[1];
    dispatch('keydown','d');el('right').dispatch('pointerdown',{pointerId:1});
    for(let i=0;i<110;i++){if(i%10===0)dispatch('keydown','d',true);tick()}
    const after=drawCalls.filter(call=>call[0]==='translate').at(-1)[1];
    assert.equal(after,before,'steering pressed during recovery does not stick after getting up');
    dispatch('keyup','d');el('right').dispatch('pointerup',{pointerId:1});
    startPracticeAndFall();el('pause').dispatch('click');el('fresh').dispatch('click');
    for(let i=0;i<20;i++)tick();assert.ok(Number(el('distance').textContent)>0,'starting fresh clears recovery and resumes movement');
    startPracticeAndFall();
    el('mode').value='downhill';el('mode').dispatch('change');
    assert.equal(String(el('distance').textContent),'0','switching modes during recovery starts a clean ready state');
    el('mode').value='practice';el('mode').dispatch('change');el('start').dispatch('click');
    for(let i=0;i<4000;i++)tick();
    assert.equal(el('percent').textContent,'ENDLESS','practice has no finish percentage');
    assert.equal(el('distance-total').hidden,true);assert.equal(el('progress-wrap').hidden,true);
    assert.equal(saved.has('echo-mountain-records-v1-practice'),false,'practice does not finish at the old finish line');
    el('pause').dispatch('click');el('end-practice').dispatch('click');
    assert.ok(el('overlay-content').html.includes('PRACTICE COMPLETE'),'ending practice shows results');
    assert.ok(saved.has('echo-mountain-records-v1-practice'),'practice uses a separate record key');
    assert.ok(JSON.parse(saved.get('echo-mountain-records-v1-practice')).beginner.last.distance>10500,'practice saves beyond the old finish');
    assert.equal(saved.get('echo-mountain-records-v1'),legacyRecord,'practice does not overwrite downhill records');
    el('mode').value='downhill';el('mode').dispatch('change');assert.equal(el('last-record').textContent,'98 M','original downhill record remains readable');
  } finally {Math.random=originalRandom}
});
