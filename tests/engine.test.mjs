import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEncounter,validate,CODES,ROLES,concept,ELEMENTS} from '../dist/engine.mjs';
test('all eight starting states are selectable from valid option tags',()=>{
  const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
  const values=[...html.matchAll(/<option\s+value="([^"]+)"/g)].map(m=>m[1]);
  for(const code of CODES)assert.ok(values.includes(code),'Missing option: '+code);
});
test('all tower colours, cleave combinations and player roles can complete all six phases',()=>{
  let count=0;
  for(const first of Object.keys(ELEMENTS))for(const second of Object.keys(ELEMENTS))for(const side1 of ['west','east'])for(const side2 of ['west','east'])for(const role of ROLES)for(const fixed of CODES){
    const e=createEncounter({first,second,side1,side2,role,fixed});
    assert.equal(e.players[e.me].code,fixed);
    assert.equal(new Set(e.players.map(p=>p.code)).size,8);
    assert.equal(new Set(e.secondPairs.flat()).size,4);
    for(let step=0;step<6;step++)assert.deepEqual(validate(e,step,e.plans[step].map(p=>p.target)),[],JSON.stringify({first,second,side1,side2,role,fixed,step}));
    count++;
  }
  assert.equal(count,2304);
});
test('missing stacks and overlapping explosions fail',()=>{
  const e=createEncounter();const positions=e.plans[0].map(p=>({...p.target}));
  const sp=e.players.findIndex(p=>p.code==='sp2');positions[sp]={x:50,y:50};
  assert.ok(validate(e,0,positions).some(p=>p.message.includes('二人分攤')));
  const i=e.players.findIndex(p=>p.code==='sA');positions[i]={...positions[e.players.findIndex(p=>p.code==='sB')]};
  assert.ok(validate(e,0,positions).some(p=>p.message.includes('概念衝突')));
});
test('wrong towers, missed copying, failed synthesis, wrong half and unwanted fusion fail',()=>{
  const e=createEncounter({first:'wind',second:'water',side1:'west'});
  const p=step=>e.plans[step].map(p=>({...p.target}));
  const fuse=p(1);fuse[e.firstPair[0]]={x:50,y:10};assert.ok(validate(e,1,fuse).length);
  const tower=p(2);tower[e.firstPair[0]]={x:54,y:26};assert.ok(validate(e,2,tower).some(p=>p.message.includes('危險半場')));
  const copy=p(3);const sp=e.players.findIndex(p=>p.code==='sp2');copy[sp]={x:9,y:50};assert.ok(validate(e,3,copy).some(p=>p.message.includes('沒有接到')));
  const mix=p(4);const rest=e.players.map((_,i)=>i).filter(i=>!e.secondPairs.flat().includes(i));mix[rest[0]]={...mix[e.secondPairs[0][0]]};assert.ok(validate(e,4,mix).some(p=>p.message.includes('非預期合成')));
  const wrong=p(5);const non=e.players.findIndex((_,i)=>!e.secondPairs.flat().includes(i)&&!e.firstPair.includes(i));
  const assigned=e.secondPairs[0][0];wrong[non]={...wrong[assigned]};wrong[assigned]={x:e.side2==='west'?10:90,y:45};assert.ok(validate(e,5,wrong).some(p=>p.message.includes('屬性不符')));
  assert.equal(concept(e,5,e.secondPairs[0][0]).type,'water');
});
