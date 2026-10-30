import { ROLES,CODES,GREEK,ELEMENTS,STEPS,STRATEGY,createEncounter,label,concept,validate,distance } from './engine.mjs';

const $=id=>document.getElementById(id);
const arena=$('arena'), ns='http://www.w3.org/2000/svg';
const colour={A:'#e49b9e',B:'#e0c47b',C:'#87bfdf',...Object.fromEntries(Object.entries(ELEMENTS).map(([k,v])=>[k,v.color]))};
let encounter,step=0,state='idle',mode='training',positions=[],dest=null,remaining=8,hold=[],wrongHolds=new Map(),demo=false,stageAge=0,counted=false,simulationElapsed=0;
let keys=new Set(),last=0,toastTimer,drawAge=0;
let stats={attempts:0,clears:0};
try{const saved=JSON.parse(localStorage.getItem('concept-lab-v1')||'{}');stats={attempts:Number(saved.attempts)||0,clears:Number(saved.clears)||0};}catch{}
const sprite=[];
function svg(tag,attrs={},text){const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!=null)el.textContent=text;return el;}
function px(p){return{x:48+p.x*5.04,y:48+p.y*5.04};}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
function saveStats(){try{localStorage.setItem('concept-lab-v1',JSON.stringify(stats));}catch{}$('attempts').textContent=stats.attempts;$('clears').textContent=stats.clears;}
function selectedRole(){return $('role').value || 'D1';}
function setDisabledSettings(disabled){document.querySelectorAll('#role-picker button, #debuff, #training, #challenge').forEach(el=>el.disabled=disabled);}
function reset(random=true){
  if(random||!encounter)encounter=createEncounter({role:selectedRole(),fixed:$('debuff').value});
  state='idle';step=0;remaining=STEPS[0].duration;demo=false;counted=false;dest=null;keys.clear();stageAge=0;simulationElapsed=0;
  positions=ROLES.map((_,i)=>({x:39+(i%4)*7,y:46+Math.floor(i/4)*9}));
  hold=[0];wrongHolds=new Map();$('result').hidden=true;document.body.classList.remove('demo');setDisabledSettings(false);updateUI();renderScene();
}
function begin(isDemo=false){
  demo=isDemo;state='running';stageAge=0;hold=currentPairs().map(()=>0);wrongHolds.clear();
  if(!demo&&!counted){counted=true;stats.attempts++;saveStats();}
  document.body.classList.toggle('demo',demo);setDisabledSettings(true);$('result').hidden=true;updateUI();renderScene();
}
function currentPairs(){return step===1?[encounter.firstPair]:step===4?encounter.secondPairs:[];}
function advance(){
  step++;dest=null;stageAge=0;wrongHolds.clear();
  if(step>=STEPS.length){finish();return;}
  remaining=STEPS[step].duration;hold=currentPairs().map(()=>0);updateUI();renderScene();
}
function resolve(){
  if(state!=='running')return;
  if(positions.some((p,i)=>i!==encounter.me&&distance(p,encounter.plans[step][i].target)>1)){
    if(mode==='training'&&!demo){toast('隊友正在就位，稍候再結算。');return;}
  }
  const issues=validate(encounter,step,positions);
  currentPairs().forEach((pair,k)=>{if(hold[k]<1.98)issues.push({player:pair.includes(encounter.me)?encounter.me:pair[0],message:'與搭檔靠近後，需要維持 2 秒才能完成合成。'});});
  if(issues.length){fail(issues);return;}
  if(!demo)toast('✓ '+STEPS[step].name+' · 成功');advance();
}
function fail(issues){
  state='failed';dest=null;keys.clear();
  const relevant=issues.filter(i=>i.player===encounter.me);const issue=(relevant.length?relevant:issues)[0];
  const unique=[...new Set((relevant.length?relevant:issues).map(i=>i.message))].slice(0,2);
  $('result').className='result-overlay failed';$('result').hidden=false;
  $('result').replaceChildren();
  const icon=document.createElement('div');icon.className='result-icon';icon.textContent='✕';
  const h=document.createElement('h2');h.textContent='概念失敗';
  const p=document.createElement('p');p.textContent=(relevant.length?'':encounter.players[issue.player].role+'：')+unique.join(' ');
  const actions=document.createElement('div');actions.className='result-actions';
  const retry=document.createElement('button');retry.className='primary-button';retry.textContent='重試本步';retry.addEventListener('click',()=>retryStep());
  const show=document.createElement('button');show.className='quiet-button';show.textContent='看本步提示';show.addEventListener('click',()=>{$('hints').checked=true;$('result').hidden=true;state='review';updateUI();renderScene();toast('已顯示正確目標；按「重試本步」重新操作。');});
  actions.append(retry,show);$('result').append(icon,h,p,actions);updateUI();
}
function retryStep(){
  $('result').hidden=true;state='running';demo=false;dest=null;keys.clear();stageAge=0;remaining=STEPS[step].duration;hold=currentPairs().map(()=>0);wrongHolds.clear();document.body.classList.remove('demo');updateUI();renderScene();
}
function finish(){
  state='cleared';dest=null;keys.clear();if(!demo){stats.clears++;saveStats();}
  $('result').className='result-overlay';$('result').hidden=false;$('result').replaceChildren();
  const icon=document.createElement('div');icon.className='result-icon';icon.textContent='◇';
  const h=document.createElement('h2');h.textContent=demo?'示範完成':'概念支配，完成。';
  const p=document.createElement('p');p.textContent=demo?'從初次分散到四塔處理，這就是本局的完整解法。換你來走一次。':'分散、補位、合成、踩塔。六個步驟全部完成，試著關閉提示再挑戰一次。';
  const actions=document.createElement('div');actions.className='result-actions';
  const again=document.createElement('button');again.className='primary-button';again.textContent=demo?'親自練習這一局':'再練一局';again.addEventListener('click',()=>{const wasDemo=demo;reset(!wasDemo);begin();});
  actions.append(again);$('result').append(icon,h,p,actions);setDisabledSettings(false);updateUI();renderScene();
}
function chooseMode(next){
  mode=next;$('hints').checked=mode==='training';reset(true);
}
function taskText(){
  if(step>=6)return ['流程完成','六個步驟全部完成。'];
  const p=encounter.players[encounter.me],code=p.code,plan=encounter.plans[step][encounter.me],g=GREEK[encounter.typeAfter[encounter.me]];
  const spot=code.length===2?code[1]:null;
  if(step===0){
    if(code.startsWith('sp'))return [code==='sp2'?'去右上 2 點':'去場地中央',code==='sp2'?'二人分攤與長 α 同站；共 2 人。':'三人分攤與長 β／γ 同站；共 3 人。'];
    if(code[0]==='s')return ['前往 '+spot+' 點','短 '+GREEK[spot]+' 在'+({A:'左上',B:'左下',C:'右下'})[spot]+'獨立引爆，遠離其他人。'];
    return [code==='lA'?'參與右上二人分攤':'參與中央三人分攤',code==='lA'?'跟二人分攤者站在右上 2 點。':'長 β、長 γ 與三人分攤者站中央。'];
  }
  if(step===1 || step===4){
    if(plan.partner!==null){const group=step===1?'中央':encounter.secondPairs[0].includes(encounter.me)?'北邊（上面合成）':'南邊（下面合成）';return ['與 '+encounter.players[plan.partner].role+' 合成', '前往'+group+'，靠近搭檔 2 秒，合成'+ELEMENTS[step===1?encounter.first:encounter.second].name+'概念。'];}
    return ['不參與這輪合成','你的概念不符合本輪塔屬性，保持分離，避免碰到其他完整概念或動物。'];
  }
  if(step===2 || step===5){const safe=(step===2?encounter.side1:encounter.side2)==='west'?'左側／西側':'右側／東側';return plan.tower!==null?['踩'+(step===2?(plan.tower===0?'北塔':'南塔'):'第 '+(plan.tower+1)+' 塔'),'站在塔的'+safe+'邊緣；每塔只站一人，避開亮起的危險半場。']:['前往安全半場','本輪不用踩塔；站在'+safe+'，遠離其他人的塔。'];}
  if(encounter.firstPair.includes(encounter.me))return ['中央待機避開爆發','你已完成第一次合成，不可接觸角落的長概念爆發。'];
  if(code[0]==='l')return ['前往 '+spot+' 點外側','長 '+GREEK[spot]+' 到角落引爆，將概念複製給內側同組玩家。'];
  return ['去 '+encounter.typeAfter[encounter.me]+' 點內側','接長 '+g+' 的爆發，取得完整 '+g+' 概念。'+(code.startsWith('sp')?'補位依第一次塔色決定。':'你沒參與首次合成，留在原角落內側。')];
}
function updateUI(){
  const s=Math.min(step,5),p=encounter.players[encounter.me],status=concept(encounter,s,encounter.me);
  $('your-concept').textContent=label(p.code);$('your-role').textContent=p.role+' · YOU';
  const col=colour[p.code[1]]||'#b6d4bd';
  $('concept-icon').textContent=p.code==='sp2'?'Ⅱ':p.code==='sp3'?'Ⅲ':GREEK[p.code[1]];$('concept-icon').style.color=col;$('concept-icon').style.borderColor=col+'88';
  $('current-concept').textContent=state==='idle'?'等待概念支配':state==='cleared'?'概念解消':status.text;
  $('training').classList.toggle('selected',mode==='training');$('challenge').classList.toggle('selected',mode==='challenge');
  $('training').setAttribute('aria-pressed',mode==='training');$('challenge').setAttribute('aria-pressed',mode==='challenge');
  $('mode-note').textContent=mode==='training'?'不限時間，準備好後手動結算。':'每步倒數結算。可暫停、調整速度。';
  $('state-badge').textContent=({idle:'準備就緒',running:demo?'自動示範':'演練中',paused:'已暫停',failed:'概念失敗',review:'查看解法',cleared:'演練完成'})[state];
  $('state-badge').className='state-badge '+(state==='failed'?'failed':state==='running'?'running':'');
  $('step-number').textContent=String(Math.min(step+1,6)).padStart(2,'0');
  $('timeline').replaceChildren(...STEPS.map((st,i)=>{
    const el=document.createElement('div');el.className='timeline-step '+(step===i?'current':step>i?'done':'');if(step===i)el.setAttribute('aria-current','step');
    const dot=document.createElement('span');dot.className='step-dot';dot.textContent=step>i?'✓':String(i+1).padStart(2,'0');
    const content=document.createElement('div');const strong=document.createElement('strong');strong.textContent=st.name;const small=document.createElement('small');small.textContent=st.en;content.append(strong,small);el.append(dot,content);return el;
  }));
  const [title,body]=taskText(),hints=$('hints').checked;
  $('task-title').textContent=hints||demo?title:'自行判讀概念';$('task-body').textContent=hints||demo?body:'提示已關閉。觀察塔色、概念狀態與隊友位置，完成本步處理。';
  const el=step>=1?(step<=3?encounter.first:encounter.second):null;
  $('tower-element').textContent=el?ELEMENTS[el].symbol+' '+ELEMENTS[el].name+'塔':'等待生成';$('tower-element').style.color=el?ELEMENTS[el].color:'#b4c6ba';
  $('tower-formula').textContent=el?(hints||demo?ELEMENTS[el].pair.map(x=>GREEK[x]).join(' + ')+' → '+ELEMENTS[el].animal+'概念':'觀察概念組合，選擇正確搭檔'):'先觀察你的起始概念';
  const primary=$('primary');
  primary.textContent=state==='idle'?'▶ 開始練習':state==='cleared'?'↻ 再練一局':state==='failed'||state==='review'?'↻ 重試本步':state==='paused'?'▶ 繼續練習':demo?'示範中…':mode==='challenge'?'倒數結算中…':'✓ 結算本步';
  primary.disabled=state==='running'&&(mode==='challenge'||demo);
  $('pause').disabled=!['running','paused'].includes(state);$('pause').textContent=state==='paused'?'▷':'Ⅱ';
  $('demo').textContent=demo&&['running','paused'].includes(state)?'□ 停止示範':'▷ 觀看示範';
  $('fusion-state').hidden=!currentPairs().length;
  saveStats();updateTimer();
}
function updateTimer(){
  const timer=$('timer');timer.replaceChildren();
  const unbounded=mode==='training'&&!demo;timer.append(document.createTextNode(unbounded?'∞':Math.max(0,remaining).toFixed(1)));
  if(state==='running'&&mode==='challenge'&&!demo)$('state-badge').textContent='剩餘 '+Math.max(0,remaining).toFixed(1)+' 秒';
  const small=document.createElement('small');small.textContent=unbounded?'不限時':demo?'自動示範':'本步剩餘秒數';timer.append(small);
  timer.style.color=!unbounded&&remaining<2?'#edab94':'';
  const pairIndex=currentPairs().findIndex(pair=>pair.includes(encounter.me));
  $('fusion-state').textContent=pairIndex>=0?hold[pairIndex]>=1.98?'✓ 合成完成':'合成進度 '+Math.min(2,hold[pairIndex]||0).toFixed(1)+' / 2.0 秒':'保持距離，等待隊友合成';
}
function buildSprites(){
  $('players').replaceChildren();sprite.length=0;
  ROLES.forEach((_,i)=>{
    const g=svg('g',{'class':'player-tag'}),glow=svg('circle',{r:16,fill:'#b8f0cf22',filter:'url(#softglow)'}),ring=svg('circle',{r:14,'class':'player-ring'}),body=svg('circle',{r:10,'class':'player-body'}),role=svg('text',{y:3.5,'class':'player-role'}),symbol=svg('text',{y:-19,'class':'player-symbol'}),you=svg('text',{y:26,'class':'you-label'},'YOU');
    g.append(glow,ring,body,role,symbol,you);$('players').append(g);sprite.push({g,glow,ring,body,role,symbol,you});
  });
}
function renderScene(){
  const s=Math.min(step,5);$('hazards').replaceChildren();$('target-layer').replaceChildren();
  if(s===2 || s===5){
    const side=s===2?encounter.side1:encounter.side2,el=ELEMENTS[s===2?encounter.first:encounter.second];
    const danger=svg('rect',{x:side==='west'?300:48,y:48,width:252,height:504,fill:'#e49f5826',stroke:'#f2b46d66','stroke-width':1});$('hazards').append(danger);
    // Repeated diagonal lines make the danger legible without relying only on colour.
    for(let y=-200;y<700;y+=25)$('hazards').append(svg('path',{d:`M${side==='west'?300:48} ${y}l252 252`,stroke:'#f0ae6333','stroke-width':1}));
    $('hazards').append(svg('text',{x:side==='west'?430:170,y:115,fill:'#e4b37c','font-size':10,'letter-spacing':2,'text-anchor':'middle'},'危險半場'));
    const ys=s===2?[26,74]:[15,38,62,85];ys.forEach((y,k)=>{
      const c=px({x:50,y}),g=svg('g');g.append(svg('circle',{cx:c.x,cy:c.y,r:45,fill:el.color+'12',stroke:el.color+'88','stroke-width':1.5}),svg('circle',{cx:c.x,cy:c.y,r:37,fill:'none',stroke:el.color+'55','stroke-dasharray':'2 5'}),svg('path',{d:`M${c.x-20} ${c.y}h40M${c.x} ${c.y-20}v40`,stroke:el.color+'33'}),svg('text',{x:c.x,y:c.y+5,'text-anchor':'middle','font-size':17,fill:el.color},el.symbol),svg('text',{x:c.x,y:c.y+31,'text-anchor':'middle','font-size':7,fill:el.color},String(k+1)));$('hazards').append(g);
    });
  }
  if(($('hints').checked||demo)&&step<6){
    const p=encounter.plans[step][encounter.me],target=px(p.target);
    const line=svg('path',{'class':'target-line',id:'hint-path'});$('target-layer').append(line,svg('circle',{cx:target.x,cy:target.y,r:19,'class':'target-circle'}),svg('path',{d:`M${target.x-5} ${target.y}h10M${target.x} ${target.y-5}v10`,stroke:'#adddcd88','stroke-width':1}),svg('text',{x:target.x,y:target.y+37,'class':'target-word'},'目標位置'));
  }
  $('effect-layer').replaceChildren();
  drawPlayers();
}
function drawPlayers(){
  const s=Math.min(step,5);
  positions.forEach((p,i)=>{
    const el=sprite[i],player=encounter.players[i],c=concept(encounter,s,i),here=px(p),isYou=i===encounter.me;
    const near=positions.map((p,j)=>({p,j})).filter(o=>distance(p,o.p)<3).map(o=>o.j);
    const shift=near.length>1?(near.indexOf(i)-(near.length-1)/2)*11:0;
    el.g.setAttribute('transform',`translate(${here.x+shift} ${here.y})`);
    el.role.textContent=player.role;el.ring.style.display=isYou?'':'none';el.glow.style.display=isYou?'':'none';el.you.style.display=isYou?'':'none';
    const rc=player.role[0]==='H'?'#49795e':player.role[0]==='D'?'#955d60':'#4c6a91';
    el.body.setAttribute('fill',rc);el.body.setAttribute('stroke',isYou?'#d3f9e7':'#b7c7c08c');
    const symbol=c.kind==='animal'?ELEMENTS[c.type].symbol:c.kind==='none'?'·':c.kind==='debuff'?player.code==='sp2'?'Ⅱ':player.code==='sp3'?'Ⅲ':(player.code[0]==='s'?'短':'長')+GREEK[player.code[1]]:GREEK[c.type];
    el.symbol.textContent=symbol;el.symbol.setAttribute('fill',colour[c.type]||'#acbfaf');
    el.g.setAttribute('aria-label',player.role+(isYou?' 你':'')+' '+c.text);
  });
  const path=$('hint-path');if(path){const a=px(positions[encounter.me]),b=px(encounter.plans[s][encounter.me].target);path.setAttribute('d',`M${a.x} ${a.y}L${b.x} ${b.y}`);}
  const effects=$('effect-layer');effects.replaceChildren();
  if($('ranges').checked&&(s===0||s===3)&&step<6){
    encounter.players.forEach((player,i)=>{if(player.code.length!==2||player.code[0]!==(s===0?'s':'l'))return;const p=px(positions[i]);effects.append(svg('circle',{cx:p.x,cy:p.y,r:38*5.04,fill:'#c59af409',stroke:'#c59af488','stroke-width':1,'stroke-dasharray':'5 6','clip-path':'url(#floor-clip)','pointer-events':'none'}));});
  }
  if((s===1||s===4)&&step<6){
    currentPairs().forEach((pair,k)=>{const a=px(positions[pair[0]]),b=px(positions[pair[1]]);if(distance(positions[pair[0]],positions[pair[1]])<=6){effects.append(svg('path',{d:`M${a.x} ${a.y}L${b.x} ${b.y}`,stroke:hold[k]>=1.98?'#adddcd':'#c3ac79','stroke-width':2,opacity:.7}),svg('circle',{cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,r:21,fill:'none',stroke:hold[k]>=1.98?'#adddcd':'#c3ac79','stroke-width':1.7,'stroke-dasharray':`${Math.min(1,hold[k]/2)*132} 132`,transform:`rotate(-90 ${(a.x+b.x)/2} ${(a.y+b.y)/2})`}));}});
  }
}
function move(p,t,amount){const d=distance(p,t);if(d<=amount)return{...t};return {x:p.x+(t.x-p.x)/d*amount,y:p.y+(t.y-p.y)/d*amount};}
function animate(time){
  const realDt=Math.min(.05,(time-last)/1000||0);last=time;const dt=realDt*Number($('speed').value);
  if(state==='running'){
    stageAge+=dt;simulationElapsed+=dt;
    positions=positions.map((p,i)=>i!==encounter.me||demo?move(p,encounter.plans[step][i].target,dt*27):p);
    if(!demo){
      let x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
      if(x||y){dest=null;const n=Math.hypot(x,y);positions[encounter.me]={x:Math.max(1,Math.min(99,positions[encounter.me].x+x/n*dt*27)),y:Math.max(1,Math.min(99,positions[encounter.me].y+y/n*dt*27))};}
      else if(dest)positions[encounter.me]=move(positions[encounter.me],dest,dt*27);
    }
    const pairs=currentPairs();pairs.forEach(([a,b],k)=>{hold[k]=distance(positions[a],positions[b])<=6?Math.min(2,hold[k]+dt):0;});
    // Concepts require sustained contact; passing through an unrelated player does not merge instantly.
    if(step===1||step===4){
      let accidental=null;
      for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){
        if(pairs.some(p=>p.includes(i)&&p.includes(j)))continue;
        const a=concept(encounter,step,i),b=concept(encounter,step,j),k=i+':'+j;
        if(['debuff','none'].includes(a.kind)||['debuff','none'].includes(b.kind))continue;
        const amount=distance(positions[i],positions[j])<=6?(wrongHolds.get(k)||0)+dt:0;wrongHolds.set(k,amount);
        if(amount>=2)accidental={player:i===encounter.me?i:j,message:'與非搭檔 '+encounter.players[i===encounter.me?j:i].role+' 持續接觸，發生非預期合成。'};
      }
      if(accidental)fail([accidental]);
    }
    if(state==='running'){
      if(demo){
        const allReady=positions.every((p,i)=>distance(p,encounter.plans[step][i].target)<.3);
        remaining=Math.max(0,STEPS[step].duration-stageAge);
        if(allReady&&stageAge>4.5&&hold.every(h=>h>=1.98))resolve();
      }else if(mode==='challenge'){remaining-=dt;if(remaining<=0)resolve();}
    }
  }
  drawAge+=realDt;
  if(drawAge>=.03){drawAge=0;drawPlayers();updateTimer();}
  requestAnimationFrame(animate);
}
function togglePause(){if(state==='running'){state='paused';keys.clear();}else if(state==='paused')state='running';else return;updateUI();}
ROLES.forEach(role=>{
  const b=document.createElement('button');b.type='button';b.textContent=role;b.dataset.role=role;b.classList.toggle('selected',role==='D1');b.setAttribute('aria-pressed',role==='D1');
  b.addEventListener('click',()=>{$('role').replaceChildren(new Option(role,role,true,true));document.querySelectorAll('#role-picker button').forEach(el=>{el.classList.toggle('selected',el.dataset.role===role);el.setAttribute('aria-pressed',el.dataset.role===role);});reset(true);});$('role-picker').append(b);
});
$('debuff').addEventListener('change',()=>reset(true));$('training').addEventListener('click',()=>chooseMode('training'));$('challenge').addEventListener('click',()=>chooseMode('challenge'));
$('primary').addEventListener('click',()=>{if(state==='idle')begin();else if(state==='cleared'){reset(true);begin();}else if(['failed','review'].includes(state))retryStep();else if(state==='paused')togglePause();else resolve();});
$('retry').addEventListener('click',()=>{reset(false);toast('已保留本局分配，重新開始。');});$('randomize').addEventListener('click',()=>{reset(true);toast('已重新抽籤。');});$('pause').addEventListener('click',togglePause);
$('demo').addEventListener('click',()=>{if(demo&&['running','paused'].includes(state)){reset(false);return;}reset(false);begin(true);});
for(const id of ['hints','ranges'])$(id).addEventListener('change',()=>{updateUI();renderScene();});
function openDialog(id){if(state==='running')togglePause();$(id).showModal();}
$('guide-open').addEventListener('click',()=>openDialog('guide-dialog'));$('help-open').addEventListener('click',()=>openDialog('help-dialog'));
document.querySelectorAll('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
arena.addEventListener('pointerdown',e=>{
  if(state!=='running'||demo){if(state==='idle')toast('先按「開始練習」，再操作角色移動。');return;}
  const pt=arena.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const local=pt.matrixTransform(arena.getScreenCTM().inverse());
  dest={x:Math.max(1,Math.min(99,(local.x-48)/5.04)),y:Math.max(1,Math.min(99,(local.y-48)/5.04))};arena.focus({preventScroll:true});
});
window.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')||['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName))return;
  const k=e.key.toLowerCase();
  if(k===' '&&!e.repeat&&['running','paused'].includes(state)){e.preventDefault();togglePause();return;}
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();if(state==='running')keys.add(k);}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();if(state==='running')togglePause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='running')togglePause();});
buildSprites();reset(true);requestAnimationFrame(animate);
