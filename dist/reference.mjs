import {STATUS_ICONS,DEBUFF_SECONDS} from './status-model.mjs';
import {ELEMENTS} from './engine.mjs';

const names={imperfect:{A:'未爆發概念 α',B:'未爆發概念 β',C:'未爆發概念 γ'},perfect:{A:'完整概念 α',B:'完整概念 β',C:'完整概念 γ'},splice:{sp2:'二人分攤',sp3:'三人分攤'}};
export function statusBadgeMarkup(group,type,seconds=null){
  const name=group==='animal'?ELEMENTS[type].name+'合成概念':names[group][type];
  return `<span class="reference-buff" role="img" aria-label="${name}${seconds===null?'':'，初始 '+seconds+' 秒'}"><img src="assets/status/${STATUS_ICONS[group][type]}.png" alt="">${seconds===null?'':`<span class="reference-seconds">${seconds}</span>`}</span>`;
}
export function statusLegendMarkup(){
  return `<div class="status-legend-group"><h3>未爆發概念</h3><div class="status-icon-pairs">${['A','B','C'].map(t=>`<div class="status-icon-pair">${statusBadgeMarkup('imperfect',t,DEBUFF_SECONDS.short)}${statusBadgeMarkup('imperfect',t,DEBUFF_SECONDS.long)}</div>`).join('')}</div><p>同種長短概念使用同一圖標，靠剩餘秒數區分。<br>初始：短 ${DEBUFF_SECONDS.short} 秒／長 ${DEBUFF_SECONDS.long} 秒。</p></div><div class="status-legend-group"><h3>分攤狀態</h3><div class="status-icon-pairs">${['sp2','sp3'].map((t,i)=>`<div class="status-icon-caption">${statusBadgeMarkup('splice',t,DEBUFF_SECONDS.splice)}<span>${i===0?'二人':'三人'}</span></div>`).join('')}</div><p>看圖標中的人數；倒數結束時結算分攤。</p></div><div class="status-legend-group"><h3>爆發後的完整概念</h3><div class="status-icon-pairs">${['A','B','C'].map(t=>statusBadgeMarkup('perfect',t)).join('')}</div><p>BUFF 變成完整概念，頭上出現三片拼圖。合成後再換成下方動物圖標。</p></div>`;
}
export function recipeOutcomeMarkup(type){
  return `<span class="recipe-arrow" aria-hidden="true">→</span><div class="recipe-result">${statusBadgeMarkup('animal',type)}<strong class="${type}">${ELEMENTS[type].name}概念</strong><small>踩${ELEMENTS[type].name}塔</small></div>`;
}
