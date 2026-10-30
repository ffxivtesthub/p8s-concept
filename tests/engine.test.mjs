import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEncounter,validate,CODES,ROLES,concept,ELEMENTS,STEPS,ROUND_STEPS,nextStep,checkpointPositions,fusionPairs,tickFusion,liveConcept,livePlan,validateRound,distance} from '../dist/engine.mjs';
import {PUZZLES,puzzleMarkup,castModel} from '../dist/ui-model.mjs';
import {statusModel,STATUS_ICONS,mechanicTime} from '../dist/status-model.mjs';

test('game status icons share long/short art and restore continuous 8s/26s timers at checkpoints',()=>{
  const debuff={kind:'debuff',type:'A'},a=statusModel(debuff,'sA',0),b=statusModel(debuff,'lA',0);
  assert.equal(a.src,b.src);assert.equal(a.countdown,'8');assert.equal(b.countdown,'26');
  assert.equal(statusModel(debuff,'lA',0,8).countdown,'18');
  assert.equal(statusModel(debuff,'lA',1).countdown,'18');
  assert.equal(statusModel(debuff,'lA',1,12).countdown,'6');
  assert.equal(statusModel(debuff,'lA',3).countdown,'6');
  assert.equal(statusModel(debuff,'lA',3,6).countdown,'0');
  assert.equal(statusModel(debuff,'lA',1,100).countdown,'6'); // manual teaching clock holds at deadline
  assert.equal(mechanicTime(2,6),mechanicTime(3,0));
  assert.equal(mechanicTime(3,6),mechanicTime(4,0));
  for(const code of ['sp2','sp3'])assert.equal(statusModel(debuff,code,0,3.1).countdown,'5');
  assert.equal(statusModel({kind:'animal',type:'water'},'sA',1).seconds,null);
  assert.equal(statusModel({kind:'concept',type:'B'},'lB',4).seconds,null);
  assert.equal(statusModel({kind:'none'},'sp2',1),null);
  assert.equal(statusModel(debuff,'lA',6),null);
  for(const group of Object.values(STATUS_ICONS))for(const id of Object.values(group)){
    const png=readFileSync(new URL(`../dist/assets/status/${id}.png`,import.meta.url));
    assert.equal(png.subarray(1,4).toString(),'PNG');
  }
});
test('head puzzles share exactly the tower element required by each legal synthesis',()=>{
  for(const [element,{pair}] of Object.entries(ELEMENTS)){
    const a=PUZZLES[pair[0]],b=PUZZLES[pair[1]];
    const shared=a.filter(t=>b.some(other=>other.key===t.key)).map(t=>t.key);
    assert.deepEqual(shared,[element]);
  }
  for(const type of ['A','B','C']){
    assert.equal(PUZZLES[type].filter(t=>t.dominant).length,1);
    assert.equal((puzzleMarkup(type).match(/class="puzzle-tile"/g)||[]).length,3);
  }
});
test('cast HUD distinguishes manual waiting, automatic countdown, pause and completion',()=>{
  const base={state:'running',mode:'training',demo:false,duration:8,age:3,remaining:8};
  assert.equal(castModel(base).seconds,5);
  assert.equal(castModel(base).progress,.375);
  assert.equal(castModel({...base,age:10}).waiting,true);
  const automatic=castModel({...base,mode:'challenge',remaining:2});
  assert.equal(automatic.seconds,2);assert.equal(automatic.progress,.75);assert.equal(automatic.waiting,false);
  assert.equal(castModel({...base,state:'paused'}).status,'已暫停');
  assert.equal(castModel({...base,state:'idle'}).progress,0);
  assert.equal(castModel({...base,state:'cleared'}).progress,1);
});

test('synthesis latches immediately and each completed pair can leave for its tower independently',()=>{
  const e=createEncounter({first:'wind',second:'water'});
  let positions=e.plans[4].map(p=>({...p.target})),holds=[0,0];
  const second=e.secondPairs[1];positions[second[0]]={x:5,y:5};
  holds=tickFusion(e,4,positions,holds,2);
  assert.deepEqual(holds,[2,0]);
  const i=e.secondPairs[0][0];assert.equal(liveConcept(e,4,i,holds).kind,'animal');
  assert.deepEqual(livePlan(e,4,i,holds).target,e.plans[5][i].target);
  assert.equal(liveConcept(e,4,second[0],holds).kind,'concept');
  positions[i]={...e.plans[5][i].target};holds=tickFusion(e,4,positions,holds,.1);
  assert.equal(holds[0],2,'walking apart must not undo a completed synthesis');
  assert.ok(validateRound(e,4,e.plans[5].map(p=>p.target),holds).some(issue=>issue.message.includes('尚未完成合成')));
  assert.deepEqual(validateRound(e,4,e.plans[5].map(p=>p.target),[2,2]),[]);
});

test('all six selectable checkpoints restore the required positions and concepts without rerolling',()=>{
  const e=createEncounter({role:'D1',fixed:'sp2',first:'water',second:'lightning'});
  const allocation=e.players.map(p=>p.code).join(',');
  for(let step=0;step<6;step++){
    const positions=checkpointPositions(e,step);assert.equal(positions.length,8);
    positions[0].x=-100;
    assert.ok(checkpointPositions(e,step)[0].x>=0,'checkpoint positions must be deep copies');
  }
  assert.equal(liveConcept(e,1,e.firstPair[0],[]).kind,'concept');
  assert.equal(liveConcept(e,2,e.firstPair[0],[]).kind,'animal');
  const sp=e.players.findIndex(p=>p.code==='sp2');assert.equal(liveConcept(e,4,sp,[]).kind,'concept');
  assert.equal(liveConcept(e,5,e.secondPairs[0][0],[]).kind,'animal');
  assert.equal(e.players.map(p=>p.code).join(','),allocation);
  assert.deepEqual(ROUND_STEPS,[0,1,3,4]);assert.equal(nextStep(1),3);assert.equal(nextStep(4),6);
});

test('both continuous rounds can fuse, split and soak before their shared deadline for every tower/cleave combination',()=>{
  for(const first of Object.keys(ELEMENTS))for(const second of Object.keys(ELEMENTS))for(const side1 of ['west','east'])for(const side2 of ['west','east']){
    const e=createEncounter({first,second,side1,side2});
    for(const step of [1,4]){
      let positions=checkpointPositions(e,step),holds=fusionPairs(e,step).map(()=>0),switched=false;
      for(let t=0;t<STEPS[step].duration;t+=.025){
        positions=positions.map((p,i)=>{
          const target=livePlan(e,step,i,holds).target,d=distance(p,target),amount=.025*27;
          return d<=amount?{...target}:{x:p.x+(target.x-p.x)/d*amount,y:p.y+(target.y-p.y)/d*amount};
        });
        holds=tickFusion(e,step,positions,holds,.025);
        if(holds.every(h=>h===2)&&t<STEPS[step].duration-2)switched=true;
      }
      assert.ok(switched,'completed synthesis must precede the tower deadline');
      assert.deepEqual(validateRound(e,step,positions,holds),[],JSON.stringify({first,second,side1,side2,step}));
    }
  }
});
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
test('first fusion partners wait apart near two oclock and outside all long concept blasts',()=>{
  for(const first of Object.keys(ELEMENTS)){
    const e=createEncounter({first});
    const positions=e.plans[3].map(p=>p.target);
    const [a,b]=e.firstPair.map(i=>positions[i]);
    assert.ok(a.x>65&&b.x>65&&a.y<30&&b.y<30,'both partners should wait in upper-right');
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>10,'fusion partners must wait apart');
    assert.deepEqual(validate(e,3,positions),[]);
  }
});
test('floor towers are shown in synthesis phases and both guides use the actual puzzle icons',()=>{
  const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.match(app,/\[1,2,4,5\]\.includes\(s\)/);
  assert.match(app,/guide-recipes/);
  assert.equal((html.match(/data-puzzle="[ABC]"/g)||[]).length,6);
  assert.match(html,/id="guide-recipes"/);
  assert.match(html,/共同圖塊/);
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
