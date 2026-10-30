export const ROLES = ['MT','ST','H1','H2','D1','D2','D3','D4'];
export const CODES = ['sA','sB','sC','lA','lB','lC','sp2','sp3'];
export const TYPES = ['A','B','C'];
export const GREEK = {A:'α',B:'β',C:'γ'};
export const ELEMENTS = {
  wind:{name:'風',animal:'鳥',pair:['A','B'],color:'#8ed7a2',symbol:'≋'},
  water:{name:'水',animal:'水妖',pair:['A','C'],color:'#79bcf7',symbol:'◇'},
  lightning:{name:'雷',animal:'獨角獸',pair:['B','C'],color:'#c59af4',symbol:'ϟ'}
};
export const STEPS = [
  {name:'初次分散',en:'IMPERFECTION',duration:8,description:'短 α／β／γ 去 A／B／C；長 α 去右上二人分攤，長 β／γ 去中央三人分攤。'},
  {name:'第一輪合成・兩塔與左右刀',en:'SYNTHESIS / ARCANE CONTROL I',duration:12,description:'看塔色合成；靠近滿兩秒立即變成動物，接著踩兩塔並躲左右刀，共用同一段倒數。'},
  {name:'兩塔與半場攻擊',en:'ARCANE CONTROL I',duration:6,description:'合成者一人一塔；所有人站在安全半場。'},
  {name:'長概念爆發',en:'CONCEPTUAL SHIFT',duration:6,description:'長概念分散；分攤者補進第一次合成空出的概念位置，複製概念。'},
  {name:'第二輪合成・四塔與左右刀',en:'SYNTHESIS / ARCANE CONTROL II',duration:12,description:'內側組上面合成、外側組下面合成；每組合成後立即前往四塔並躲左右刀，共用同一段倒數。'},
  {name:'四塔與半場攻擊',en:'ARCANE CONTROL II',duration:6,description:'四名新合成者各踩一塔，同時躲避第二次半場攻擊。'}
];
// Verified against the user's local 菓子 guide, 09:00–12:10 (especially 09:30, 11:00, 11:40).
export const STRATEGY = {name:'菓子攻略',verified:true,spots:{A:[5,5],B:[5,95],C:[95,95]},inner:{A:[20,20],B:[20,80],C:[80,80]},stack2:[74,25],stack3:[50,50]};
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export const point = ([x,y]) => ({x,y});
export const ROUND_STEPS = [0,1,3,4];
export const isFusionRound = step => step===1||step===4;
export const nextStep = step => step===1?3:step===4?6:step+1;
export function fusionPairs(e,step){return step===1?[e.firstPair]:step===4?e.secondPairs:[];}
export function checkpointPositions(e,step){
  if(!Number.isInteger(step)||step<0||step>5)throw new RangeError('Invalid practice checkpoint');
  return step===0?ROLES.map((_,i)=>({x:39+(i%4)*7,y:46+Math.floor(i/4)*9})):e.plans[step-1].map(p=>({...p.target}));
}
// Completed synthesis is latched: walking apart afterwards must not undo it.
export function tickFusion(e,step,positions,holds,dt){
  return fusionPairs(e,step).map(([a,b],k)=>holds[k]>=2?2:distance(positions[a],positions[b])<=6?Math.min(2,(holds[k]||0)+dt):0);
}
export function liveConcept(e,step,i,holds=[]){
  const k=fusionPairs(e,step).findIndex(pair=>pair.includes(i));
  return concept(e,isFusionRound(step)&&k>=0&&holds[k]>=2?step+1:step,i);
}
export function livePlan(e,step,i,holds=[]){
  if(!isFusionRound(step))return e.plans[step][i];
  const k=fusionPairs(e,step).findIndex(pair=>pair.includes(i));
  return e.plans[k<0||holds[k]>=2?step+1:step][i];
}
export function validateRound(e,step,positions,holds=[]){
  if(!isFusionRound(step))return validate(e,step,positions);
  const issues=[];
  fusionPairs(e,step).forEach((pair,k)=>{if(!(holds[k]>=2))for(const i of pair)issues.push({player:i,message:'尚未完成合成：與正確搭檔靠近滿兩秒，再前往塔位。'});});
  // Towers and the cleave resolve together at the shared deadline.
  issues.push(...validate(e,step+1,positions));
  return issues;
}
export function label(code) {
  if (code==='sp2') return '二人分攤';
  if (code==='sp3') return '三人分攤';
  return ((code.length===2&&code[0]==='s')?'短 ':'長 ') + GREEK[code[1]];
}
export function shuffle(array,rng=Math.random) {
  const a=[...array]; for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
}
export function createEncounter({role='D1',fixed='random',first,second,side1,side2,rng=Math.random}={}) {
  const codes=shuffle(CODES,rng), me=ROLES.indexOf(role);
  if (CODES.includes(fixed)) {const i=codes.indexOf(fixed);[codes[me],codes[i]]=[codes[i],codes[me]];}
  const elements=Object.keys(ELEMENTS);
  const e={players:ROLES.map((role,i)=>({role,code:codes[i]})),me,
    first:first||elements[Math.floor(rng()*3)],second:second||elements[Math.floor(rng()*3)],
    side1:side1|| (rng()<.5?'west':'east'),side2:side2|| (rng()<.5?'west':'east')};
  const idx=code=>codes.indexOf(code);
  e.firstPair=ELEMENTS[e.first].pair.map(t=>idx('s'+t));
  e.copyTypes={ [idx('sp2')]:ELEMENTS[e.first].pair[0], [idx('sp3')]:ELEMENTS[e.first].pair[1] };
  e.typeAfter=e.players.map((p,i)=>e.copyTypes[i] || p.code[1]);
  e.secondPairs=[ELEMENTS[e.second].pair.map(t=>e.players.findIndex((p,i)=>p.code[0]!=='l'&&!e.firstPair.includes(i)&&e.typeAfter[i]===t)),ELEMENTS[e.second].pair.map(t=>idx('l'+t))];
  e.plans=Array.from({length:6},(_,step)=>makePlan(e,step));
  return e;
}
function makePlan(e,step) {
  const side=step===2?e.side1:e.side2;
  const safe=side==='west'?46:54,outer=side==='west'?10:90;
  const p=e.players.map((player,i)=>{
    const {code}=player;
    const start=code==='sp2'?STRATEGY.stack2:code==='sp3'?STRATEGY.stack3:(code.length===2&&code[0]==='s')?STRATEGY.spots[code[1]]:code==='lA'?STRATEGY.stack2:STRATEGY.stack3;
    let target=point(start),action='散開',partner=null,tower=null;
    if(step===0){action=(code.length===2&&code[0]==='s')?'獨立引爆':code==='sp2'||code==='lA'?'二人分攤':'三人分攤';}
    if(step===1){
      if(e.firstPair.includes(i)){const order=e.firstPair.indexOf(i);target={x:49+order*2,y:50};partner=e.firstPair[1-order];action='合成'+ELEMENTS[e.first].name;}
      else {target=(code.length===2&&code[0]==='s')?point(STRATEGY.spots[code[1]]):{x:16,y:22+['lA','lB','lC','sp2','sp3'].indexOf(code)*14};action='保持分離';}
    }
    if(step===2){
      const order=e.firstPair.indexOf(i);
      if(order>=0){tower=order;target={x:safe,y:order===0?26:74};action='踩'+(order===0?'北':'南')+'塔';}
      else {const rest=e.players.map((_,j)=>j).filter(j=>!e.firstPair.includes(j));target={x:outer,y:12+rest.indexOf(i)*15};action='躲半場攻擊';}
    }
    if(step===3){
      const order=e.firstPair.indexOf(i);
      if(order>=0){target={x:order===0?72:85,y:order===0?14:24};action='右上 2 點附近分散待機，避開長概念爆發';}
      else {const type=e.typeAfter[i];target=point(code[0]==='l'?STRATEGY.spots[type]:STRATEGY.inner[type]);action=code[0]==='l'?'長概念引爆':'複製 '+GREEK[type];}
    }
    if(step===4 || step===5){
      let group=-1,order=-1;
      e.secondPairs.forEach((pair,g)=>{if(pair.includes(i)){group=g;order=pair.indexOf(i);partner=pair[1-order];}});
      if(group>=0){
        if(step===4){target={x:49+order*2,y:group===0?26:74};action=(group===0?'北組':'南組')+'合成'+ELEMENTS[e.second].name;}
        else {tower=group*2+order;target={x:safe,y:[15,38,62,85][tower]};action='踩第 '+(tower+1)+' 塔';}
      } else {const rest=e.players.map((_,j)=>j).filter(j=>!e.secondPairs.flat().includes(j));target={x:step===4?8:outer,y:12+rest.indexOf(i)*25};action=step===4?'保持分離':'躲半場攻擊';}
    }
    return {target,action,partner,tower};
  });
  return p;
}
export function concept(e,step,i) {
  const p=e.players[i];
  if(step===0) return {text:label(p.code),type:p.code[1],kind:'debuff'};
  if(e.firstPair.includes(i)&&step>=2) return {text:ELEMENTS[e.first].name+' · '+ELEMENTS[e.first].animal,type:e.first,kind:'animal'};
  if(step>=5&&e.secondPairs.flat().includes(i)) return {text:ELEMENTS[e.second].name+' · '+ELEMENTS[e.second].animal,type:e.second,kind:'animal'};
  if(step<=3 && !(p.code.length===2&&p.code[0]==='s')) return {text:p.code[0]==='l'?label(p.code):'無概念',type:p.code[1],kind:p.code[0]==='l'?'debuff':'none'};
  const t=step>=4?e.typeAfter[i]:p.code[1];
  return {text:GREEK[t]+' 完整概念',type:t,kind:'concept'};
}
export function validate(e,step,positions) {
  const issues=[];
  const add=(i,message)=>issues.push({player:i,message});
  if(positions.some(p=>p.x<1||p.x>99||p.y<1||p.y>99)){positions.forEach((p,i)=>{if(p.x<1||p.x>99||p.y<1||p.y>99)add(i,'離開了有效場地。');});}
  if(step===0 || step===3){
    const short=step===0;
    const explosions=e.players.map((p,i)=>({p,i})).filter(({p})=>p.code.length===2&&p.code[0]===(short?'s':'l'));
    for (const {p,i} of explosions){
      const expected=short?[i]:e.players.map((_,j)=>j).filter(j=>!e.firstPair.includes(j)&&e.typeAfter[j]===p.code[1]);
      for(let j=0;j<8;j++){
        const hit=distance(positions[i],positions[j])<=38;
        if(expected.includes(j)&&!hit) add(j,'沒有接到 '+label(p.code)+' 的概念爆發，無法複製正確概念。');
        if(!expected.includes(j)&&hit) add(j,'被 '+label(p.code)+' 的大範圍爆發波及，概念衝突。');
      }
    }
    if(short) for(const [code,count] of [['sp2',2],['sp3',3]]){
      const i=e.players.findIndex(p=>p.code===code);
      const hit=positions.map((p,j)=>({p,j})).filter(({p})=>distance(p,positions[i])<=9);
      if(hit.length!==count) add(i,label(code)+' 需要 '+count+' 人，範圍內實際有 '+hit.length+' 人。');
    }
  }
  if(step===1 || step===4){
    const pairs=step===1?[e.firstPair]:e.secondPairs;
    for(const pair of pairs){const [a,b]=pair;if(distance(positions[a],positions[b])>6){add(a,'與 '+e.players[b].role+' 距離太遠，未完成合成。');add(b,'與 '+e.players[a].role+' 距離太遠，未完成合成。');}}
    for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){
      if(pairs.some(pair=>pair.includes(i)&&pair.includes(j)))continue;
      const a=concept(e,step,i),b=concept(e,step,j);
      if(a.kind==='debuff'||a.kind==='none'||b.kind==='debuff'||b.kind==='none')continue;
      if(distance(positions[i],positions[j])<=6){add(i,'與 '+e.players[j].role+' 發生非預期合成，請與非搭檔保持距離。');add(j,'與 '+e.players[i].role+' 發生非預期合成，請與非搭檔保持距離。');}
    }
  }
  if(step===2 || step===5){
    const side=step===2?e.side1:e.side2;
    positions.forEach((p,i)=>{if(side==='west'?p.x>=50:p.x<=50)add(i,'站在危險半場：這次 '+(side==='west'?'東側':'西側')+' 被攻擊。');});
    const ys=step===2?[26,74]:[15,38,62,85];
    ys.forEach((y,k)=>{
      const soaked=positions.map((p,i)=>({p,i})).filter(({p})=>distance(p,{x:50,y})<=9);
      if(soaked.length!==1){const expected=e.plans[step].findIndex(t=>t.tower===k);add(expected,'第 '+(k+1)+' 塔需要一人，實際有 '+soaked.length+' 人。');}
      for(const {i} of soaked){const c=concept(e,step,i);if(c.kind!=='animal'||c.type!==(step===2?e.first:e.second))add(i,'概念與第 '+(k+1)+' 塔屬性不符。');}
    });
  }
  return issues;
}
