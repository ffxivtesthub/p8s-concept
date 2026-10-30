import {STEPS} from './engine.mjs';

// 菓子影片 07:30: short concepts/splices 8s; long concepts 26s.
export const DEBUFF_SECONDS={short:8,long:26,splice:8};
export const CHECKPOINT_SECONDS=[0,8,14,20,26,32];
export const STATUS_ICONS={
  imperfect:{A:215489,B:215490,C:215491},
  perfect:{A:215492,B:215493,C:215494},
  animal:{wind:215496,water:215497,lightning:215498},
  splice:{sp2:215105,sp3:215106}
};
export function mechanicTime(step,age=0){
  if(step>=6)return 38;
  return CHECKPOINT_SECONDS[step]+Math.max(0,Math.min(STEPS[step].duration,age));
}
export function statusModel(concept,code,step,age=0){
  if(step>=6||concept.kind==='none')return null;
  const id=concept.kind==='animal'?STATUS_ICONS.animal[concept.type]
    :concept.kind==='concept'?STATUS_ICONS.perfect[concept.type]
    :code.startsWith('sp')?STATUS_ICONS.splice[code]:STATUS_ICONS.imperfect[code[1]];
  const duration=concept.kind==='debuff'?(code.startsWith('sp')?DEBUFF_SECONDS.splice:code[0]==='l'?DEBUFF_SECONDS.long:DEBUFF_SECONDS.short):null;
  const seconds=duration===null?null:Math.max(0,duration-mechanicTime(step,age));
  return {src:`assets/status/${id}.png`,seconds,countdown:seconds===null?'':String(Math.ceil(Number(seconds.toFixed(6)))),urgent:seconds!==null&&seconds<=5};
}
