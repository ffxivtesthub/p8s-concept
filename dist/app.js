import { ROLES,CODES,GREEK,ELEMENTS,STEPS,STRATEGY,ROUND_STEPS,isFusionRound,nextStep,fusionPairs,checkpointPositions,tickFusion,liveConcept,livePlan,validateRound,createEncounter,label,concept,validate,distance } from './engine.mjs';
import {PUZZLES,TILES,puzzleMarkup,castModel} from './ui-model.mjs';
import {statusModel} from './status-model.mjs';
import {statusBadgeMarkup,statusLegendMarkup,recipeOutcomeMarkup} from './reference.mjs';

const $=id=>document.getElementById(id);
const arena=$('arena'), ns='http://www.w3.org/2000/svg';
const colour={A:'#e49b9e',B:'#e0c47b',C:'#87bfdf',...Object.fromEntries(Object.entries(ELEMENTS).map(([k,v])=>[k,v.color]))};
let encounter,step=0,state='idle',mode='training',positions=[],dest=null,remaining=8,hold=[],wrongHolds=new Map(),demo=false,stageAge=0,counted=false,simulationElapsed=0;
let practiceStart=0,entryPositions=[],finishedSegment=false,cleaveShown=false;
const roundBase=s=>s===2?1:s>=4?4:s;
const actorConcept=i=>liveConcept(encounter,Math.min(step,5),i,hold);
const actorPlan=i=>livePlan(encounter,Math.min(step,5),i,hold);
const showCleave=()=>step===2||step===5||(isFusionRound(step)&&stageAge>=6);
let keys=new Set(),last=0,toastTimer,drawAge=0;
let stats={attempts:0,clears:0};
try{const saved=JSON.parse(localStorage.getItem('concept-lab-v1')||'{}');stats={attempts:Number(saved.attempts)||0,clears:Number(saved.clears)||0};}catch{}
const sprite=[];
// Both reference surfaces share the same game icons and recipe rendering.
document.querySelectorAll('[data-status-legend]').forEach(el=>el.innerHTML=statusLegendMarkup());
document.querySelectorAll('[data-status-badge]').forEach(el=>{
  const [group,type]=el.dataset.statusBadge.split(':');
  el.innerHTML=statusBadgeMarkup(group,type,el.dataset.seconds?Number(el.dataset.seconds):null);
});
document.querySelectorAll('.recipe-outcome[data-element]').forEach(el=>el.innerHTML=recipeOutcomeMarkup(el.dataset.element));
$('guide-recipes').append(...[...document.querySelectorAll('.recipe-strip .recipe')].map(card=>card.cloneNode(true)));
document.querySelectorAll('svg[data-puzzle]').forEach(diagram=>{
  diagram.innerHTML=puzzleMarkup(diagram.dataset.puzzle,diagram.dataset.highlight);
});
function svg(tag,attrs={},text){const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!=null)el.textContent=text;return el;}
function px(p){return{x:48+p.x*5.04,y:48+p.y*5.04};}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
function saveStats(){try{localStorage.setItem('concept-lab-v1',JSON.stringify(stats));}catch{}$('attempts').textContent=stats.attempts;$('clears').textContent=stats.clears;}
function selectedRole(){return $('role').value || 'D1';}
function setDisabledSettings(disabled){document.querySelectorAll('#role-picker button, #debuff, #training, #challenge').forEach(el=>el.disabled=disabled);}
function reset(random=true,start=practiceStart){
  if(random||!encounter)encounter=createEncounter({role:selectedRole(),fixed:$('debuff').value});
  state='idle';step=start;practiceStart=start;remaining=STEPS[step].duration;demo=false;counted=false;dest=null;keys.clear();stageAge=0;simulationElapsed=0;finishedSegment=false;cleaveShown=false;
  positions=checkpointPositions(encounter,step);entryPositions=positions.map(p=>({...p}));
  hold=currentPairs().map(()=>0);wrongHolds=new Map();$('result').hidden=true;document.body.classList.remove('demo');setDisabledSettings(false);updateUI();renderScene();
}
function jumpToStage(target){$('single-stage').checked=true;reset(false,target);toast('已載入本段起點，保留本局分配與塔色。');}
function begin(isDemo=false){
  demo=isDemo;state='running';stageAge=0;hold=currentPairs().map(()=>0);wrongHolds.clear();
  if(!demo&&!counted){counted=true;stats.attempts++;saveStats();}
  document.body.classList.toggle('demo',demo);setDisabledSettings(true);$('result').hidden=true;updateUI();renderScene();
}
function currentPairs(){return fusionPairs(encounter,step);}
function advance(){
  step=nextStep(step);dest=null;stageAge=0;wrongHolds.clear();cleaveShown=false;
  if(step>=STEPS.length){finish();return;}
  remaining=STEPS[step].duration;hold=currentPairs().map(()=>0);entryPositions=positions.map(p=>({...p}));updateUI();renderScene();
}
function resolve(){
  if(state!=='running')return;
  if(positions.some((p,i)=>i!==encounter.me&&distance(p,actorPlan(i).target)>1)){
    if(mode==='training'&&!demo){toast('隊友正在就位，稍候再結算。');return;}
  }
  const issues=validateRound(encounter,step,positions,hold);
  if(issues.length){fail(issues);return;}
  if(!demo)toast('✓ '+STEPS[step].name+' · 成功');
  if($('single-stage').checked)finish(true);else advance();
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
  $('result').hidden=true;state='running';demo=false;dest=null;keys.clear();stageAge=0;remaining=STEPS[step].duration;positions=entryPositions.map(p=>({...p}));hold=currentPairs().map(()=>0);wrongHolds.clear();cleaveShown=false;document.body.classList.remove('demo');updateUI();renderScene();
}
function finish(segment=false){
  state='cleared';finishedSegment=segment;dest=null;keys.clear();if(!demo&&!segment&&practiceStart===0){stats.clears++;saveStats();}
  $('result').className='result-overlay';$('result').hidden=false;$('result').replaceChildren();
  const icon=document.createElement('div');icon.className='result-icon';icon.textContent='◇';
  const h=document.createElement('h2');h.textContent=segment?'本段練習完成':demo?'示範完成':'概念支配，完成。';
  const p=document.createElement('p');p.textContent=segment?'本段處理成功。可重練本段，或使用階段選單前往其他起點。':demo?'從選定起點到最後一輪踩塔，這就是本局的解法。換你來走一次。':'從選定起點到最後一輪踩塔已完成，試著關閉提示再挑戰一次。';
  const actions=document.createElement('div');actions.className='result-actions';
  const again=document.createElement('button');again.className='primary-button';again.textContent=segment?'重練本段':demo?'親自練習這一局':'再練一局';again.addEventListener('click',()=>{const wasDemo=demo;reset(segment?false:!wasDemo);begin();});
  actions.append(again);$('result').append(icon,h,p,actions);setDisabledSettings(false);updateUI();renderScene();
}
function chooseMode(next){
  mode=next;$('hints').checked=mode==='training';reset(true);
}
function taskText(){
  if(step>=6)return ['流程完成','合成、踩塔與左右刀已連續處理完成。'];
  const p=encounter.players[encounter.me],code=p.code,plan=actorPlan(encounter.me),g=GREEK[encounter.typeAfter[encounter.me]];
  const spot=code.length===2?code[1]:null;
  if(step===0){
    if(code.startsWith('sp'))return [code==='sp2'?'去右上 2 點':'去場地中央',code==='sp2'?'二人分攤與長 α 同站；共 2 人。':'三人分攤與長 β／γ 同站；共 3 人。'];
    if(code[0]==='s')return ['前往 '+spot+' 點','短 '+GREEK[spot]+' 在'+({A:'左上',B:'左下',C:'右下'})[spot]+'獨立引爆，遠離其他人。'];
    return [code==='lA'?'參與右上二人分攤':'參與中央三人分攤',code==='lA'?'跟二人分攤者站在右上 2 點。':'長 β、長 γ 與三人分攤者站中央。'];
  }
  if(step===1 || step===4){
    if(plan.tower!==null){const side=(step===1?encounter.side1:encounter.side2)==='west'?'西側／左側':'東側／右側';return ['合成完成，立即踩第 '+(plan.tower+1)+' 塔','不用等待讀條！現在前往自己的塔；左右刀提示亮起後，站在塔的'+side+'邊緣。塔與左右刀在這段讀條結束時一起判定。'];}
    if(plan.partner!==null){const element=step===1?encounter.first:encounter.second;const group=step===1?'中央':encounter.secondPairs[0].includes(encounter.me)?'北邊（上面合成）':'南邊（下面合成）';return ['與 '+encounter.players[plan.partner].role+' 合成','先看地上「'+ELEMENTS[element].name+'」塔圈，再比對兩人頭上拼圖共同的「'+ELEMENTS[element].name+'」圖塊；前往'+group+'靠近搭檔 2 秒。'];}
    return ['不用合成，準備躲左右刀','本輪不踩塔，先保持分離；左右刀提示亮起後前往安全半場。'];
  }
  if(step===2 || step===5){const safe=(step===2?encounter.side1:encounter.side2)==='west'?'左側／西側':'右側／東側';return plan.tower!==null?['踩'+(step===2?(plan.tower===0?'北塔':'南塔'):'第 '+(plan.tower+1)+' 塔'),'站在塔的'+safe+'邊緣；每塔只站一人，避開亮起的危險半場。']:['前往安全半場','本輪不用踩塔；站在'+safe+'，遠離其他人的塔。'];}
  if(encounter.firstPair.includes(encounter.me))return ['右上 2 點附近分散待機','兩名首次合成者在右上方分開站，避開長概念爆發範圍，不要再接概念。'];
  if(code[0]==='l')return ['前往 '+spot+' 點外側','長 '+GREEK[spot]+' 到角落引爆，將概念複製給內側同組玩家。'];
  return ['去 '+encounter.typeAfter[encounter.me]+' 點內側','接長 '+g+' 的爆發，取得完整 '+g+' 概念。'+(code.startsWith('sp')?'補位依第一次塔色決定。':'你沒參與首次合成，留在原角落內側。')];
}
function updateUI(){
  const s=Math.min(step,5),p=encounter.players[encounter.me],status=actorConcept(encounter.me);
  $('your-concept').textContent='目前狀態';$('your-role').textContent=p.role+' · YOU';
  $('current-concept').textContent=state==='cleared'?(finishedSegment?'本段完成':'概念解消'):({debuff:'概念待爆發',concept:'完整概念',animal:'合成完成',none:'尚無概念'})[status.kind];
  $('training').classList.toggle('selected',mode==='training');$('challenge').classList.toggle('selected',mode==='challenge');
  $('training').setAttribute('aria-pressed',mode==='training');$('challenge').setAttribute('aria-pressed',mode==='challenge');
  $('mode-note').textContent=mode==='training'?'BUFF 隨段落倒數；讀條結束後停表，等手動結算。':'合成、踩塔與左右刀共用一段倒數。';
  $('state-badge').textContent=({idle:'準備就緒',running:demo?'自動示範':'演練中',paused:'已暫停',failed:'概念失敗',review:'查看解法',cleared:'演練完成'})[state];
  $('state-badge').className='state-badge '+(state==='failed'?'failed':state==='running'?'running':'');
  $('step-number').textContent=String(Math.min(ROUND_STEPS.indexOf(roundBase(s))+1,4)).padStart(2,'0');
  $('stage-select').value=String(step>=6?4:step);$('previous-stage').disabled=step===0;$('next-stage').disabled=step>=4;
  $('timeline').replaceChildren(...ROUND_STEPS.map((i,n)=>{
    const st=STEPS[i],el=document.createElement('button'),current=roundBase(s)===i&&step<6;
    el.type='button';el.className='timeline-step '+(current?'current':step>i?'done':'');if(current)el.setAttribute('aria-current','step');el.addEventListener('click',()=>jumpToStage(i));
    const dot=document.createElement('span');dot.className='step-dot';dot.textContent=step>i&&!current?'✓':String(n+1).padStart(2,'0');
    const content=document.createElement('div');const strong=document.createElement('strong');strong.textContent=st.name;const small=document.createElement('small');small.textContent=st.en;content.append(strong,small);el.append(dot,content);return el;
  }));
  const [title,body]=taskText(),hints=$('hints').checked;
  $('task-title').textContent=hints||demo?title:'自行判讀概念';$('task-body').textContent=hints||demo?body:'提示已關閉。觀察塔色、概念狀態與隊友位置，完成本步處理。';
  const el=step>=1?(step<=3?encounter.first:encounter.second):null;
  $('tower-element').textContent=el?ELEMENTS[el].symbol+' '+ELEMENTS[el].name+'塔':'等待生成';$('tower-element').style.color=el?ELEMENTS[el].color:'#b4c6ba';
  $('tower-formula').textContent=el?(hints||demo?'找兩人拼圖都含有的「'+ELEMENTS[el].name+'」圖塊 → '+ELEMENTS[el].animal+'概念':'觀察地上塔圈，找兩人的共同拼圖圖塊'):'先觀察你的起始概念';
  const primary=$('primary');
  primary.textContent=state==='idle'?'▶ 開始練習':state==='cleared'?(finishedSegment?'↻ 重練本段':'↻ 再練一局'):state==='failed'||state==='review'?'↻ 重試本步':state==='paused'?'▶ 繼續練習':demo?'示範中…':mode==='challenge'?'倒數結算中…':isFusionRound(step)?'✓ 結算踩塔與左右刀':'✓ 結算本步';
  primary.disabled=state==='running'&&(mode==='challenge'||demo);
  $('pause').disabled=!['running','paused'].includes(state);$('pause').textContent=state==='paused'?'▷':'Ⅱ';
  $('demo').textContent=demo&&['running','paused'].includes(state)?'□ 停止示範':'▷ 觀看示範';
  $('fusion-state').hidden=!currentPairs().length;
  updatePuzzleReadout();
  saveStats();updateTimer();
}
function updatePuzzleReadout(){
  const c=actorConcept(encounter.me),diagram=$('my-puzzle');
  if(step>=6){diagram.replaceChildren();$('puzzle-description').textContent='概念解消，演練完成。';diagram.setAttribute('aria-label','概念已解消');return;}
  if(c.kind==='concept'){
    const tower=step<=3?encounter.first:encounter.second;
    diagram.innerHTML=puzzleMarkup(c.type,$('hints').checked||demo?tower:null);
    const available=PUZZLES[c.type].filter(t=>!t.dominant).map(t=>TILES[t.key].name).join('／');
    $('puzzle-description').textContent='你有'+available+'。找與你同樣有本輪塔元素的人；金框是主元素。';diagram.setAttribute('aria-label',GREEK[c.type]+' 拼圖，可合成 '+available);
  }else if(c.kind==='animal'){
    diagram.innerHTML=`<image href="${statusModel(c,encounter.players[encounter.me].code,step,stageAge).src}" x="-23" y="-63" width="46" height="62"/>`;
    $('puzzle-description').textContent='合成完成，現在持有'+ELEMENTS[c.type].name+'概念。依目標前往塔位。';diagram.setAttribute('aria-label',c.text);
  }else{
    diagram.innerHTML='<text x="0" y="-20" text-anchor="middle" fill="#748f85" font-size="28">◇</text>';
    $('puzzle-description').textContent=c.kind==='none'?'尚無拼圖，接到長概念爆發後會取得。':'目前是未爆發狀態，爆發後頭上才會顯示拼圖。';diagram.setAttribute('aria-label','尚未取得完整概念拼圖');
  }
}
function updateTimer(){
  const status=statusModel(actorConcept(encounter.me),encounter.players[encounter.me].code,step,stageAge);
  const portrait=$('concept-icon'),image=$('status-image'),countdown=$('status-countdown');
  portrait.hidden=!status;
  if(status){if(image.getAttribute('src')!==status.src)image.setAttribute('src',status.src);image.alt=actorConcept(encounter.me).text;countdown.textContent=status.countdown;countdown.hidden=status.seconds===null;portrait.classList.toggle('urgent',status.urgent);portrait.title=actorConcept(encounter.me).text+(status.seconds===null?'':'，剩餘 '+status.countdown+' 秒');}
  const timer=$('timer');timer.replaceChildren();
  const unbounded=mode==='training'&&!demo;timer.append(document.createTextNode(unbounded?'∞':Math.max(0,remaining).toFixed(1)));
  if(state==='running'&&mode==='challenge'&&!demo)$('state-badge').textContent='剩餘 '+Math.max(0,remaining).toFixed(1)+' 秒';
  const small=document.createElement('small');small.textContent=unbounded?'不限時':demo?'自動示範':'本步剩餘秒數';timer.append(small);
  timer.style.color=!unbounded&&remaining<2?'#edab94':'';
  const pairIndex=currentPairs().findIndex(pair=>pair.includes(encounter.me));
  $('fusion-state').textContent=pairIndex>=0?hold[pairIndex]>=1.98?'✓ 合成完成':'合成進度 '+Math.min(2,hold[pairIndex]||0).toFixed(1)+' / 2.0 秒':'保持距離，等待隊友合成';
  const cast=castModel({state,mode,demo,duration:STEPS[Math.min(step,5)].duration,age:stageAge,remaining});
  $('cast-name').textContent=finishedSegment?'本段完成':step>=6?'概念解消':isFusionRound(step)?(step===1?'兩塔＋左右刀結算':'四塔＋左右刀結算'):STEPS[step].name;
  $('cast-seconds').replaceChildren(document.createTextNode(cast.seconds.toFixed(1)));
  const unit=document.createElement('small');unit.textContent='s';$('cast-seconds').append(unit);
  $('cast-fill').style.width=(cast.progress*100)+'%';
  $('cast-track').setAttribute('aria-valuenow',String(Math.round(cast.progress*100)));
  $('cast-track').setAttribute('aria-valuetext',cast.status+'，剩餘 '+cast.seconds.toFixed(1)+' 秒');
  $('cast-status').textContent=finishedSegment?'本段練習完成':isFusionRound(step)&&state==='running'&&!cast.waiting?'合成後立即踩塔 · '+(showCleave()?'左右刀已亮起':'留意稍後左右刀'):(cast.status);$('cast-hud').dataset.state=state;$('cast-hud').classList.toggle('cast-ready',cast.waiting);
  $('link-cast').hidden=pairIndex<0||step>=6;
  if(pairIndex>=0){const h=Math.min(2,hold[pairIndex]||0);$('link-fill').style.width=(h/2*100)+'%';$('link-seconds').textContent=h.toFixed(1)+' / 2.0s';$('link-label').textContent=h>=1.98?'連結完成':'與搭檔接觸合成';}
}
function buildSprites(){
  $('players').replaceChildren();sprite.length=0;
  ROLES.forEach((_,i)=>{
    const g=svg('g',{'class':'player-tag'}),glow=svg('circle',{r:16,fill:'#b8f0cf22',filter:'url(#softglow)'}),ring=svg('circle',{r:14,'class':'player-ring'}),body=svg('circle',{r:10,'class':'player-body'}),role=svg('text',{y:3.5,'class':'player-role'}),symbol=svg('text',{y:-19,'class':'player-symbol'}),you=svg('text',{y:26,'class':'you-label'},'YOU');
    const statusImage=svg('image',{'class':'player-status-image',x:-15,y:-55,width:30,height:40}),puzzle=svg('g',{'class':'overhead-puzzle'}),stem=svg('path',{stroke:'#b4c7bf66','stroke-width':.7,fill:'none'});
    g.append(glow,ring,body,role,stem,puzzle,statusImage,symbol,you);$('players').append(g);sprite.push({g,glow,ring,body,role,symbol,you,puzzle,statusImage,stem,puzzleKey:''});
  });
}
function renderScene(){
  const s=Math.min(step,5);$('hazards').replaceChildren();$('target-layer').replaceChildren();
  if(showCleave()){
    const side=s<=2?encounter.side1:encounter.side2;
    const danger=svg('rect',{x:side==='west'?300:48,y:48,width:252,height:504,fill:'#e49f5826',stroke:'#f2b46d66','stroke-width':1});$('hazards').append(danger);
    // Repeated diagonal lines make the danger legible without relying only on colour.
    for(let y=-200;y<700;y+=25)$('hazards').append(svg('path',{d:`M${side==='west'?300:48} ${y}l252 252`,stroke:'#f0ae6333','stroke-width':1}));
    $('hazards').append(svg('text',{x:side==='west'?430:170,y:115,fill:'#e4b37c','font-size':10,'letter-spacing':2,'text-anchor':'middle'},'危險半場'));
  }
  // 塔圈從「選合成對象」時就存在，而不是踩塔階段才突然出現。
  if([1,2,4,5].includes(s)){
    const el=ELEMENTS[s<=2?encounter.first:encounter.second];
    const ys=s<=2?[26,74]:[15,38,62,85];
    ys.forEach((y,k)=>{
      const c=px({x:50,y}),g=svg('g',{'class':'floor-tower','aria-label':`第 ${k+1} 座${el.name}塔圈`});
      g.append(
        svg('circle',{cx:c.x,cy:c.y,r:51,fill:el.color+'42',filter:'url(#softglow)'}),
        svg('circle',{cx:c.x,cy:c.y,r:46,fill:'#14251fdd',stroke:el.color,'stroke-width':4}),
        svg('circle',{cx:c.x,cy:c.y,r:39,fill:el.color+'29',stroke:'#f7f1d8','stroke-width':1.6,'stroke-dasharray':'5 5'}),
        svg('circle',{cx:c.x,cy:c.y,r:32,fill:'none',stroke:el.color+'cc','stroke-width':1.8}),
        svg('text',{x:c.x,y:c.y-3,'text-anchor':'middle','font-size':22,'font-weight':'800',fill:'#f4fff8',stroke:'#132a24','stroke-width':2,'paint-order':'stroke'},el.name),
        svg('text',{x:c.x,y:c.y+15,'text-anchor':'middle','font-size':11,'font-weight':'700',fill:el.color},'塔圈'),
        svg('text',{x:c.x,y:c.y+34,'text-anchor':'middle','font-size':10,fill:'#e8e2c3'},String(k+1))
      );
      $('hazards').append(g);
    });
  }
  if(($('hints').checked||demo)&&step<6){
    const p=actorPlan(encounter.me),target=px(p.target);
    const line=svg('path',{'class':'target-line',id:'hint-path'});$('target-layer').append(line,svg('circle',{cx:target.x,cy:target.y,r:19,'class':'target-circle'}),svg('path',{d:`M${target.x-5} ${target.y}h10M${target.x} ${target.y-5}v10`,stroke:'#adddcd88','stroke-width':1}),svg('text',{x:target.x,y:target.y+37,'class':'target-word'},'目標位置'));
  }
  $('effect-layer').replaceChildren();
  drawPlayers();
}
function drawPlayers(){
  const s=Math.min(step,5);
  positions.forEach((p,i)=>{
    const el=sprite[i],player=encounter.players[i],c=actorConcept(i),here=px(p),isYou=i===encounter.me;
    const near=positions.map((p,j)=>({p,j})).filter(o=>distance(p,o.p)<3).map(o=>o.j);
    const shift=near.length>1?(near.indexOf(i)-(near.length-1)/2)*11:0;
    el.g.setAttribute('transform',`translate(${here.x+shift} ${here.y})`);
    el.role.textContent=player.role;el.ring.style.display=isYou?'':'none';el.glow.style.display=isYou?'':'none';el.you.style.display=isYou?'':'none';
    const rc=player.role[0]==='H'?'#49795e':player.role[0]==='D'?'#955d60':'#4c6a91';
    el.body.setAttribute('fill',rc);el.body.setAttribute('stroke',isYou?'#d3f9e7':'#b7c7c08c');
    const showPuzzle=c.kind==='concept'&&step<6;
    const highlight=($('hints').checked||demo)?s<=3?encounter.first:encounter.second:null;
    const key=showPuzzle?c.type+':'+highlight:'';
    if(el.puzzleKey!==key){el.puzzle.innerHTML=showPuzzle?puzzleMarkup(c.type,highlight):'';el.puzzleKey=key;}
    const overheadShift=near.length>1?(near.indexOf(i)-(near.length-1)/2)*(showPuzzle?30:34):0;
    el.puzzle.setAttribute('transform',`translate(${overheadShift} 0)`);
    const buff=statusModel(c,player.code,step,stageAge),showStatus=!!buff&&!showPuzzle;
    el.stem.setAttribute('d',showPuzzle||showStatus?`M0 -12L${overheadShift} -22`:'');
    el.statusImage.style.display=showStatus?'':'none';
    if(showStatus){
      if(el.statusImage.getAttribute('href')!==buff.src)el.statusImage.setAttribute('href',buff.src);
      const animal=c.kind==='animal',w=animal?42:30;
      el.statusImage.setAttribute('x',overheadShift-w/2);el.statusImage.setAttribute('y',animal?-64:-57);
      el.statusImage.setAttribute('width',w);el.statusImage.setAttribute('height',w*4/3);
    }
    el.symbol.textContent=showStatus?buff.countdown:'';
    el.symbol.setAttribute('fill',buff?.urgent?'#ffb69c':'#fff3d9');el.symbol.setAttribute('y',-12);el.symbol.setAttribute('x',overheadShift);
    const shared=showPuzzle?PUZZLES[c.type].map(t=>TILES[t.key].name).join('、'):'';
    el.g.setAttribute('aria-label',player.role+(isYou?' 你':'')+' '+c.text+(shared?'，拼圖：'+shared:''));
  });
  const path=$('hint-path');if(path){const a=px(positions[encounter.me]),b=px(actorPlan(encounter.me).target);path.setAttribute('d',`M${a.x} ${a.y}L${b.x} ${b.y}`);}
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
    positions=positions.map((p,i)=>i!==encounter.me||demo?move(p,actorPlan(i).target,dt*27):p);
    if(!demo){
      let x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
      if(x||y){dest=null;const n=Math.hypot(x,y);positions[encounter.me]={x:Math.max(1,Math.min(99,positions[encounter.me].x+x/n*dt*27)),y:Math.max(1,Math.min(99,positions[encounter.me].y+y/n*dt*27))};}
      else if(dest)positions[encounter.me]=move(positions[encounter.me],dest,dt*27);
    }
    const pairs=currentPairs(),before=hold;hold=tickFusion(encounter,step,positions,hold,dt);
    if(hold.some((h,k)=>h>=2&&before[k]<2)){updateUI();renderScene();}
    if(isFusionRound(step)&&stageAge>=6&&!cleaveShown){cleaveShown=true;updateUI();renderScene();}
    // Concepts require sustained contact; passing through an unrelated player does not merge instantly.
    if(step===1||step===4){
      let accidental=null;
      for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){
        if(pairs.some(p=>p.includes(i)&&p.includes(j)))continue;
        const a=actorConcept(i),b=actorConcept(j),k=i+':'+j;
        if(['debuff','none'].includes(a.kind)||['debuff','none'].includes(b.kind))continue;
        const amount=distance(positions[i],positions[j])<=6?(wrongHolds.get(k)||0)+dt:0;wrongHolds.set(k,amount);
        if(amount>=2)accidental={player:i===encounter.me?i:j,message:'與非搭檔 '+encounter.players[i===encounter.me?j:i].role+' 持續接觸，發生非預期合成。'};
      }
      if(accidental)fail([accidental]);
    }
    if(state==='running'){
      if(demo){
        const allReady=positions.every((p,i)=>distance(p,actorPlan(i).target)<.3);
        remaining=Math.max(0,STEPS[step].duration-stageAge);
        if(allReady&&remaining<=0&&hold.every(h=>h>=1.98))resolve();
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
$('primary').addEventListener('click',()=>{if(state==='idle')begin();else if(state==='cleared'){reset(!finishedSegment);begin();}else if(['failed','review'].includes(state))retryStep();else if(state==='paused')togglePause();else resolve();});
$('stage-select').addEventListener('change',()=>jumpToStage(Number($('stage-select').value)));
$('previous-stage').addEventListener('click',()=>{if(step===2||step===5){jumpToStage(step-1);return;}const base=roundBase(Math.min(step,5));jumpToStage(ROUND_STEPS[Math.max(0,ROUND_STEPS.indexOf(base)-1)]);});
$('next-stage').addEventListener('click',()=>{const base=roundBase(Math.min(step,5));jumpToStage(ROUND_STEPS[Math.min(3,ROUND_STEPS.indexOf(base)+1)]);});
$('repeat-stage').addEventListener('click',()=>jumpToStage(Math.min(step,5)));
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
