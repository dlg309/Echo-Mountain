import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCourse} from '../dist/course.mjs';
import {newRun,start,update} from '../dist/engine.mjs';

test('game inputs reach the rider renderer after a ramp', async()=>{
  let clock=1000, nextFrame, drawCalls=[];
  const events=new Map(), elements=new Map();
  const listen=(map,type,fn)=>{if(!map.has(type))map.set(type,[]);map.get(type).push(fn)};
  class Element {
    constructor(id){this.id=id;this.listeners=new Map();this.style={};this.dataset={};this.value='';this.hidden=false;this.textContent='';this.classList={add(){},remove(){},toggle(){}}}
    addEventListener(type,fn){listen(this.listeners,type,fn)}
    dispatch(type,extra={}){const e={target:this,preventDefault(){},...extra};for(const fn of this.listeners.get(type)||[])fn(e)}
    focus(){} scrollIntoView(){} setAttribute(){} setPointerCapture(){}
    getBoundingClientRect(){return {width:570,height:700}}
    set innerHTML(value){this.html=value}
    get innerHTML(){return this.html}
    querySelector(){return null}
    insertAdjacentHTML(){}
  }
  const el=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
  const ctx=new Proxy({}, {get(obj,key){if(['drawImage','rotate','strokeText'].includes(key))return (...args)=>drawCalls.push([key,...args]);return obj[key]??(()=>{})},set(obj,key,value){obj[key]=value;return true}});
  el('game').getContext=()=>ctx;
  el('difficulty').value='beginner';el('lighting').value='day';el('fog').checked=true;
  const trickButtons=['180','360','720','frontflip','backflip'].map(name=>{const b=new Element(name);b.dataset.trick=name;return b});
  globalThis.document={querySelector(selector){return el(selector.replace(/^#/,''))},querySelectorAll(){return trickButtons},addEventListener(){}};
  globalThis.window=globalThis;
  globalThis.localStorage={getItem(){return null},setItem(){},removeItem(){}};
  globalThis.addEventListener=(type,fn)=>listen(events,type,fn);
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>clock}});
  globalThis.requestAnimationFrame=fn=>{nextFrame=fn};
  globalThis.ResizeObserver=class{observe(){}};
  globalThis.matchMedia=()=>({matches:false,addEventListener(){}});
  globalThis.Image=class{naturalWidth=400;set src(value){this.onload()}};
  const originalRandom=Math.random;Math.random=()=>0;
  try{
    await import('../dist/game.mjs');
    const dispatch=(type,key)=>{for(const fn of events.get(type)||[])fn({key,target:el('game'),preventDefault(){},repeat:false})};
    const tick=()=>{clock+=1000/60;const cb=nextFrame;assert.ok(cb,'game loop scheduled a frame');nextFrame=null;cb(clock)};
    for(const [input,label] of [['z','180'],['x','360'],['c','720'],['v','FRONT FLIP'],['b','BACKFLIP'],['g','180'],['h','360'],['j','720'],['k','FRONT FLIP'],['l','BACKFLIP'],['touch','FRONT FLIP'],['queued','FRONT FLIP'],['motion','FRONT FLIP']]){
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
      if(input==='motion')el('trick-motion').dispatch('click');
      if(input==='touch')trickButtons[3].dispatch('pointerdown');else if(input==='motion')dispatch('keydown','v');else if(input!=='queued')dispatch('keydown',input);
      for(let i=0;i<12;i++)tick();
      if(!['touch','queued','motion'].includes(input))dispatch('keyup',input);
      assert.ok(drawCalls.some(call=>call[0]==='strokeText'&&call[1]===label),`${input}: trick label was drawn`);
      const frames=new Set(drawCalls.filter(call=>call[0]==='drawImage').map(call=>`${call[2]},${call[3]}`));
      assert.ok(frames.size,`${input}: rider sprite was drawn`);
      if(['v','b','k','l','touch','queued'].includes(input))assert.ok(frames.size>1,`${input}: flip frames advanced`);
      else if(input==='motion')assert.equal(frames.size,1,'motion off keeps the rider still');
      else assert.ok(drawCalls.some(call=>call[0]==='rotate'&&Math.abs(call[1])>.5),`${input}: board rotated`);
    }
  } finally {Math.random=originalRandom}
});
