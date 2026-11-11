import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('the shared page exposes the game controls and all modes exactly once',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const ids=['game','overlay','overlay-content','cue','mode','difficulty','lighting','fog','fog-setting','fog-status',
    'pause','help','left','right','score','multiplier','speed','time','distance','length','percent',
    'progress','progress-wrap','distance-total','trail-name','level-badge','light-icon','light-name','light-caption','record-level','last-record',
    'best-record','storage-note'];
  for(const id of ids)assert.equal((html.match(new RegExp(`\\bid=["']${id}["']`,'g'))||[]).length,1,`${id} is present once`);
  assert.doesNotMatch(html,/id=["']trick-motion["']/);
  for(const mode of ['downhill','practice','ramps','halfpipe'])assert.match(html,new RegExp(`<option value=["']${mode}["']>`));
  for(const trick of ['180','360','720','frontflip','backflip'])assert.match(html,new RegExp(`data-trick=["']${trick}["']`));
});
