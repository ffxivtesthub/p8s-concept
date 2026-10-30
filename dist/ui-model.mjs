// Triangular concept layouts verified from the guide at 08:20.
// The shared wind/water/lightning elements determine HC1 synthesis.
export const PUZZLES = {
  A:[{key:'water',x:0,y:-45},{key:'alpha',x:-12,y:-24,dominant:true},{key:'wind',x:12,y:-24}],
  B:[{key:'lightning',x:-12,y:-45},{key:'wind',x:12,y:-45},{key:'beta',x:0,y:-24,dominant:true}],
  C:[{key:'lightning',x:-12,y:-45},{key:'gamma',x:0,y:-24,dominant:true},{key:'water',x:12,y:-24}]
};
export const TILES={
  alpha:{name:'α 主元素',color:'#ec654d',shape:'M0-6C1-2 5-1 4 3C3 7-4 7-4 2C-4-1-1-2 0-6ZM0 0C-3 4 1 6 2 3'},
  beta:{name:'β 主元素',color:'#e4b63d',shape:'M-5 0Q0-7 5-2Q9 4 2 6Q-5 7-4 2Q-3-1 1-1Q4-1 3 2Q2 4 0 2'},
  gamma:{name:'γ 主元素',color:'#d59634',shape:'M0 6V-7M0 3Q-6 2-5-3Q0-2 0 3ZM0 0Q5-1 5-6Q0-4 0 0M0 5Q6 4 6 0Q2 0 0 5'},
  wind:{name:'風',color:'#47bf89',shape:'M-6-3H3Q8-3 6-6Q4-8 3-5M-6 0H6M-5 3H2Q7 3 5 6Q3 8 2 5'},
  water:{name:'水',color:'#41b8e8',shape:'M0-7C-1-3-6 0-5 3Q-4 8 1 7Q7 6 5 1C3-2 1-4 0-7ZM-2 2Q-3 5 0 5'},
  lightning:{name:'雷',color:'#a77be9',shape:'M1-8-6 2H-1L-3 9 6-2H1Z'}
};
const hex=r=>Array.from({length:6},(_,i)=>{const a=(i*60-30)*Math.PI/180;return `${(Math.cos(a)*r).toFixed(2)},${(Math.sin(a)*r).toFixed(2)}`;}).join(' ');
export function puzzleMarkup(type,highlight=null){
  return (PUZZLES[type]||[]).map(t=>{
    const d=TILES[t.key],hot=t.key===highlight;
    return `<g class="puzzle-tile" data-element="${t.key}" transform="translate(${t.x} ${t.y})"><title>${d.name}${t.dominant?'（金框主元素）':''}</title>${hot?`<polygon points="${hex(13)}" fill="${d.color}44" stroke="#eeffe9" stroke-width="1.3"/>`:''}<polygon points="${hex(10.5)}" fill="${d.color}" stroke="${t.dominant?'#ffe18a':'#c8f0fa'}" stroke-width="${t.dominant?2.2:1}"/><polygon points="${hex(8.1)}" fill="#111b2833" stroke="${t.dominant?'#ffdd8e':'#ffffff44'}" stroke-width=".6"/><path d="${d.shape}" fill="none" stroke="#fff5db" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>${hot?`<text x="0" y="18" text-anchor="middle" fill="${d.color}" class="puzzle-match-word">${d.name}</text>`:''}</g>`;
  }).join('');
}
export function castModel({state,mode,demo,duration,age,remaining}){
  const manual=mode==='training'&&!demo;
  const seconds=state==='idle'?duration:state==='cleared'?0:Math.max(0,manual?duration-age:remaining);
  const progress=state==='idle'?0:state==='cleared'?1:Math.max(0,Math.min(1,1-seconds/duration));
  const waiting=manual&&seconds===0&&state==='running';
  const status=state==='idle'?'準備施放':state==='paused'?'已暫停':state==='failed'?'施放中斷':state==='review'?'檢視失敗原因':state==='cleared'?'概念解消':waiting?'讀條完成 · 等待手動結算':manual?'教學讀條 · 可手動結算':demo?'示範讀條 · 讀完自動結算':'讀完自動結算';
  return {seconds,progress,waiting,status};
}
