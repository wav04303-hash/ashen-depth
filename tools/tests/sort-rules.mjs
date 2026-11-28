import { readFileSync } from 'node:fs';
const code = readFileSync(new URL('../../index.html', import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function stub(){const f=function(){};return new Proxy(f,{get(t,k){if(k===Symbol.toPrimitive)return()=>0;if(k==='then')return undefined;if(!(k in t)||k==='length'||k==='name')t[k]=stub();return t[k];},apply(){return stub();},set(t,k,v){t[k]=v;return true;}});}
const ls={getItem:()=>null,setItem(){},removeItem(){}};
const G=new Function('document','window','setInterval','setTimeout','requestAnimationFrame','localStorage','navigator',code+
 ';return {get S(){return S},RT,step,genItem,recalc,addLoot,sortSweep,upgradeScore,salvReason};')(stub(),stub(),()=>0,()=>0,()=>0,ls,stub());
const S=G.S,RT=G.RT;let ok=0,bad=0;
const T=(name,c)=>{if(c){ok++;}else{bad++;console.log('FAIL',name);}};
const mk=(slot,ilvl,rar,set)=>{let it;for(let i=0;i<2000;i++){it=G.genItem(ilvl,rar,set);if(it.slot===slot)break;}return it;};
S.autoSalv=[false,false,false];
// 장비: 무기 ilvl 30 희귀
const w=mk('weapon',30,2);S.eq.weapon=w;S.eq.boots=mk('boots',30,2);S.eq.gloves=mk('gloves',30,2);G.recalc();
// 1) 약하면 분해 (희귀 이하)
S.sort.weak=true;S.sort.weakTo=2;
const weak=mk('weapon',5,2);G.addLoot(weak);T('weak rare salvaged',!S.inv.includes(weak));
const strong=mk('weapon',60,2);G.addLoot(strong);T('strong kept',S.inv.includes(strong));
// 2) 남기기 옵션 우선
const weak2=mk('weapon',5,2);S.sort.keep=[weak2.aff[0].k];G.addLoot(weak2);T('keep-affix beats weak',S.inv.includes(weak2));S.sort.keep=[];
// 3) 전설: 희귀 이하만이면 남고, 전설까지면 분해
const lg=mk('weapon',5,3);G.addLoot(lg);T('legend kept with weakTo=2',S.inv.includes(lg));
S.sort.weakTo=3;const lg2=mk('weapon',5,3);G.addLoot(lg2);T('legend salvaged with weakTo=3',!S.inv.includes(lg2));
// 4) 중복 세트
S.sort.dup=true;S.setSeen={};
const s1=mk('helm',20,4,'guard');G.addLoot(s1);T('fresh set kept',S.inv.includes(s1));
const s2=mk('helm',10,4,'guard');G.addLoot(s2);T('lower dup salvaged',!S.inv.includes(s2));
const s3=mk('helm',40,4,'guard');G.addLoot(s3);T('higher dup kept',S.inv.includes(s3));
G.sortSweep(true);T('sweep removes lower set piece',!S.inv.includes(s1)&&S.inv.includes(s3));
// 5) 가방 정리: 잠금·전설 보존, 약한 희귀 분해
const wk=mk('boots',1,2),lk=mk('boots',1,2);lk.lock=true;S.inv.push(wk,lk);
const n0=G.sortSweep(true);T('sweep salvages weak',!S.inv.includes(wk));T('sweep keeps locked',S.inv.includes(lk));T('sweep keeps legend',S.inv.includes(lg));
// 6) 자동 정리 토글: 30초 뒤 가방 정리 + 기록 한 줄
S.sort.on=true;const wk2=mk('gloves',1,2);S.inv.push(wk2);const l0=RT.log.length;
for(let t=0;t<31;t+=0.05)G.step(0.05);
T('auto sweep after 30s',!S.inv.includes(wk2));T('log line',RT.log.slice(l0).some(x=>x.includes('자동 정리')));
// 7) 꺼져 있으면 가방은 그대로
S.sort.on=false;const wk3=mk('gloves',1,2);S.inv.push(wk3);for(let t=0;t<31;t+=0.05)G.step(0.05);T('no sweep when off',S.inv.includes(wk3));
// 8) 등급별 자동 분해는 마지막 (남기기 옵션이면 남음)
S.sort.weak=false;S.autoSalv=[true,true,true];const g1=mk('ring',50,1);S.sort.keep=[g1.aff[0].k];G.addLoot(g1);T('keep beats grade',S.inv.includes(g1));
S.sort.keep=[];const g2=mk('ring',50,1);G.addLoot(g2);T('grade salvage',!S.inv.includes(g2));
console.log(`통과 ${ok} / 실패 ${bad}`);
