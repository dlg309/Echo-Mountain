import {WIDTH,UNITS_PER_METRE} from './course.mjs';
import {validRecord} from './records.mjs';
import {fogDistance,MAX_FOG_OPACITY} from './fog.mjs';
const palettes={
  day:{snow:'#e4f2ef',contour:'#cfe7e0',shine:'#f9fffc',edge:'#c1e0d8',shadow:'#a3c8bc',tree:'#285e50',leaf:'#53917a',rock:'#829b99',pole:'#779b91',flag:'#df9c79',light:'#f5fbf4',fog:'241,248,246'},
  sunrise:{snow:'#f4e6df',contour:'#e5cbd0',shine:'#fff7ed',edge:'#e6c6bf',shadow:'#cbaeb0',tree:'#5b6671',leaf:'#9a8990',rock:'#a79391',pole:'#b29294',flag:'#de9179',light:'#fff0d7',fog:'255,239,227'},
  sunset:{snow:'#e9dce0',contour:'#d7bacb',shine:'#ffece7',edge:'#d8bdc7',shadow:'#baa0b2',tree:'#4a566a',leaf:'#837a90',rock:'#988994',pole:'#a28698',flag:'#e6a070',light:'#fce5d9',fog:'246,226,230'},
  night:{snow:'#304c65',contour:'#3b5d72',shine:'#638196',edge:'#213f54',shadow:'#1a3546',tree:'#113e3b',leaf:'#286a55',rock:'#6c8492',pole:'#96b4bd',flag:'#f4bd86',light:'#cceddf',fog:'142,166,183'},
};
function round(ctx,x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function tree(ctx,e,x,y,p){
  const r=e.halfWidth;ctx.fillStyle=p.shadow;ctx.beginPath();ctx.ellipse(x+5,y+r*.58,r*1.05,r*.5,0,0,Math.PI*2);ctx.fill();
  // A compact, slightly elevated evergreen silhouette reads as a tree on a
  // top-down course while staying within the same collision radius.
  round(ctx,x-r*.12,y+r*.35,r*.24,r*.57,2,'#765e4e');
  function tier(top,bottom,width,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x, y+top*r);ctx.lineTo(x-width*r,y+bottom*r);ctx.lineTo(x+width*r,y+bottom*r);ctx.closePath();ctx.fill()}
  tier(-.95,.44,.64,p.tree);tier(-.60,.70,.88,p.tree);tier(-.93,.21,.54,p.leaf);tier(-.48,.49,.74,p.leaf);
  ctx.strokeStyle=p.light;ctx.lineWidth=2.5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-r*.34,y-r*.05);ctx.lineTo(x-r*.12,y-r*.30);ctx.moveTo(x+r*.07,y-r*.44);ctx.lineTo(x+r*.24,y-r*.20);ctx.moveTo(x-r*.48,y+r*.36);ctx.lineTo(x-r*.25,y+r*.16);ctx.moveTo(x+r*.21,y+r*.08);ctx.lineTo(x+r*.43,y+r*.31);ctx.stroke();
}
function rock(ctx,e,x,y,p){
  const sx=e.halfWidth/24,sy=e.halfHeight/20;ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);
  ctx.fillStyle=p.shadow;ctx.beginPath();ctx.ellipse(5,9,25,16,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=p.rock;ctx.beginPath();ctx.moveTo(-24,8);ctx.lineTo(-19,-9);ctx.lineTo(-7,-20);ctx.lineTo(9,-18);ctx.lineTo(22,-8);ctx.lineTo(24,6);ctx.lineTo(12,16);ctx.lineTo(-10,17);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(40,66,66,.17)';ctx.beginPath();ctx.moveTo(-7,-20);ctx.lineTo(2,-4);ctx.lineTo(24,6);ctx.lineTo(12,16);ctx.lineTo(-10,17);ctx.lineTo(-6,5);ctx.closePath();ctx.fill();
  ctx.strokeStyle=p.light;ctx.lineWidth=2.8;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(-17,-8);ctx.lineTo(-7,-15);ctx.lineTo(4,-14);ctx.lineTo(10,-10);ctx.stroke();ctx.restore();
}
function fence(ctx,e,x,y,p){ctx.strokeStyle=p.shadow;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x-e.halfWidth,y+8);ctx.lineTo(x+e.halfWidth,y+8);ctx.stroke();ctx.strokeStyle='#cf7763';ctx.lineWidth=4;ctx.strokeRect(x-e.halfWidth,y-8,e.halfWidth*2,16);ctx.lineWidth=1.3;for(let i=-e.halfWidth;i<=e.halfWidth;i+=11){ctx.beginPath();ctx.moveTo(x+i,y-8);ctx.lineTo(x+i+6,y+8);ctx.stroke()}round(ctx,x-e.halfWidth-3,y-12,6,25,2,'#d9a480');round(ctx,x+e.halfWidth-3,y-12,6,25,2,'#d9a480')}
function ramp(ctx,e,x,y,p){const w=e.halfWidth,h=e.halfHeight;ctx.fillStyle=p.shadow;ctx.beginPath();ctx.ellipse(x+3,y+8,w+5,h*.8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=e.kind==='ramp-large'?'#e3a76c':'#a9c9b9';ctx.beginPath();ctx.moveTo(x-w,y+h);ctx.lineTo(x-w*.8,y-h);ctx.lineTo(x+w*.8,y-h);ctx.lineTo(x+w,y+h);ctx.closePath();ctx.fill();ctx.strokeStyle=p.light;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-w*.82,y-h+5);ctx.lineTo(x+w*.82,y-h+5);ctx.stroke();ctx.beginPath();ctx.moveTo(x-9,y-7);ctx.lineTo(x,y+2);ctx.lineTo(x+9,y-7);ctx.moveTo(x-9,y+1);ctx.lineTo(x,y+10);ctx.lineTo(x+9,y+1);ctx.stroke()}
function marker(ctx,y,side,title,color,dist){const x=side==='left'?20:WIDTH-20,sign=side==='left'?1:-1;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-17);ctx.lineTo(x,y+18);ctx.stroke();ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-17);ctx.lineTo(x+sign*73,y-17);ctx.lineTo(x+sign*67,y-2);ctx.lineTo(x,y-2);ctx.fill();ctx.fillStyle='#fff';ctx.textAlign=side==='left'?'left':'right';ctx.font='700 8px sans-serif';ctx.fillText(title,x+sign*5,y-7);ctx.fillStyle=color;ctx.font='700 10px sans-serif';ctx.fillText(`${Math.round(dist/UNITS_PER_METRE)} M`,x+sign*5,y+14)}
function endSpot(ctx,x,y,color,radius){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();ctx.restore()}
function rider(ctx,run,x,y,p){
  const progress=run.airDuration?1-run.airTime/run.airDuration:0;
  const height=run.airTime>0?Math.sin(progress*Math.PI)*(run.airKind==='large'?48:29):0;
  ctx.fillStyle=run.airTime>0?'#143b3d55':p.shadow;ctx.beginPath();ctx.ellipse(x+4,y+11,15+height*.25,8+height*.1,0,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.translate(x,y-height);ctx.rotate(-run.tilt);const scale=1.25+height/180;ctx.scale(scale,scale);
  // The board points downhill; shoulders and knees are offset in a sideways stance.
  round(ctx,-6,-27,12,54,6,'#cc7456');round(ctx,-4,18,8,6,4,'#f1bb8e');
  ctx.strokeStyle='#eac29d';ctx.lineWidth=2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-4,-13);ctx.lineTo(4,-13);ctx.moveTo(-4,11);ctx.lineTo(4,11);ctx.stroke();
  ctx.strokeStyle='#24424a';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(-3,-5);ctx.lineTo(1,1);ctx.moveTo(0,11);ctx.lineTo(4,6);ctx.lineTo(1,1);ctx.stroke();
  ctx.save();ctx.translate(1,-3);ctx.rotate(-.52);round(ctx,-6,-10,12,19,5,'#244b52');
  ctx.strokeStyle='#244b52';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-5,-6);ctx.lineTo(-12,0);ctx.lineTo(-11,5);ctx.moveTo(5,-5);ctx.lineTo(11,-10);ctx.lineTo(14,-9);ctx.stroke();
  ctx.fillStyle='#e4b794';ctx.beginPath();ctx.arc(0,-12,5.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f6faf4';ctx.beginPath();ctx.arc(0,-14,5.5,Math.PI,Math.PI*2);ctx.fill();ctx.restore();ctx.restore();
}
function drawFog(ctx,run,h,p,margin){
  const anchor=h*.22,{clear,dense}=fogDistance(run.speed);
  const grad=ctx.createLinearGradient(0,anchor+clear,0,anchor+dense);
  grad.addColorStop(0,`rgba(${p.fog},0)`);grad.addColorStop(.45,`rgba(${p.fog},.19)`);grad.addColorStop(1,`rgba(${p.fog},${MAX_FOG_OPACITY})`);
  ctx.fillStyle=grad;ctx.fillRect(-margin,anchor+clear,WIDTH+margin*2,Math.max(0,h-anchor-clear));
}
export function render(ctx,canvas,run,light,record,fogEnabled=false){
  const p=palettes[light]||palettes.day,w=canvas.width,h=canvas.height,margin=(w-WIDTH)/2,viewY=run.y-h*.22;
  ctx.fillStyle=p.snow;ctx.fillRect(0,0,w,h);ctx.save();ctx.translate(margin,0);
  for(let y=Math.floor(viewY/180)*180;y<viewY+h+180;y+=180){const sy=y-viewY;ctx.strokeStyle=p.contour;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,sy);ctx.bezierCurveTo(180,sy-30,400,sy+30,720,sy-8);ctx.stroke();ctx.strokeStyle=p.shine;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(90,sy+60);ctx.quadraticCurveTo(190,sy+50,260,sy+65);ctx.stroke()}
  ctx.fillStyle=p.edge;ctx.fillRect(-margin,0,margin+10,h);ctx.fillRect(WIDTH-10,0,margin+10,h);
  for(let distance=1000;distance<run.course.length;distance+=1000){const y=distance-viewY;if(y< -40||y>h+40)continue;ctx.strokeStyle=p.pole;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(18,y-13);ctx.lineTo(18,y+12);ctx.stroke();ctx.fillStyle=p.flag;ctx.beginPath();ctx.moveTo(18,y-13);ctx.lineTo(60,y-13);ctx.lineTo(54,y-1);ctx.lineTo(18,y-1);ctx.fill();ctx.font='700 8px sans-serif';ctx.textAlign='left';ctx.fillStyle='#fff';ctx.fillText(`${distance/UNITS_PER_METRE} M`,22,y-4)}
  const finish=run.course.length-viewY;if(finish>-50&&finish<h+50){ctx.fillStyle='#275b50';ctx.fillRect(14,finish-4,WIDTH-28,8);for(let x=14;x<WIDTH-14;x+=28){ctx.fillStyle=(Math.floor((x-14)/28)%2)?'#285b50':'#f7fff9';ctx.fillRect(x,finish-15,Math.min(28,WIDTH-14-x),11)}ctx.fillStyle=p.tree;ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('FINISH',WIDTH/2,finish+25)}
  for(const e of run.course.entities){const y=e.y-viewY;if(y< -85||y>h+85)continue;if(e.kind==='tree')tree(ctx,e,e.x,y,p);else if(e.kind==='rock'||e.kind==='rock-small')rock(ctx,e,e.x,y,p);else if(e.kind==='fence')fence(ctx,e,e.x,y,p);else ramp(ctx,e,e.x,y,p)}
  if(validRecord(record?.last,run.course)){const y=record.last.distance-viewY;if(y>-40&&y<h+40){marker(ctx,y,'left','LAST RUN','#d98469',record.last.distance);endSpot(ctx,record.last.x,y,'#d98469',10)}}
  if(validRecord(record?.best,run.course)){const y=record.best.distance-viewY;if(y>-40&&y<h+40){marker(ctx,y,'right','LONGEST','#6a9e89',record.best.distance);endSpot(ctx,record.best.x,y,'#6a9e89',15)}}
  if(fogEnabled&&run.difficulty==='expert')drawFog(ctx,run,h,p,margin);
  rider(ctx,run,run.x,run.y-viewY,p);ctx.restore();
}
