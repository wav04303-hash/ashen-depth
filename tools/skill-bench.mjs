// 스킬·갈래 화력 비교: node tools/skill-bench.mjs [스킬 레벨=15] [시드 수=3]
// 맞기만 하는 허수아비(1마리 / 3마리)에게 60초 동안 스킬 하나만 장착하고 쓴 피해를 잰다.
// 평타만 쓸 때와의 차이를 「평타 대비 추가 화력」(평타 화력 = 1)으로 보여 준다.
// 처형처럼 적 생명력에 따라 달라지는 스킬을 위해 허수아비 생명력이 가득 찬 경우와 25%인 경우를 반씩 섞는다.
import { readFileSync } from 'node:fs';
const code = readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const SL = +(process.argv[2] || 15), SEEDS = +(process.argv[3] || 3);
function stub(){const f=function(){};return new Proxy(f,{get(t,k){if(k===Symbol.toPrimitive)return()=>0;if(k==='then')return undefined;if(!(k in t)||k==='length'||k==='name')t[k]=stub();return t[k];},apply(){return stub();},set(t,k,v){t[k]=v;return true;}});}
function mulberry32(a){return function(){a|=0;a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function boot(seed){Math.random=mulberry32(seed);const ls={getItem:()=>null,setItem(){},removeItem(){}};
  return new Function('document','window','setInterval','setTimeout','requestAnimationFrame','localStorage','navigator',code+
  ';return {get S(){return S},RT,step,genItem,recalc,mkEnemy,SKILLS,SKMAP,skP,BR_LV,resetSkillFx,GEMS:typeof GEMS!=="undefined"?GEMS:[],gemOk:typeof gemOk!=="undefined"?gemOk:null};')(stub(),stub(),()=>0,()=>0,()=>0,ls,stub());}
function run(seed,slot,branch,n,low,gem){
  const G=boot(seed),S=G.S,RT=G.RT;S.lvl=60;S.stage=S.maxStage=30;S.autoPush=false;
  for(const sk of G.SKILLS)S.skills[sk.id]=SL;S.br={};if(slot&&branch)S.br[slot]=[branch];
  if(gem&&slot){S.gems=[{u:1,g:gem,r:+(process.env.GEMR||1)}];S.sock={[slot]:[1]};}
  for(const part of ['weapon','helm','chest','gloves','boots','ring','amulet']){let it;for(let k=0;k<500;k++){it=G.genItem(30,2);if(it.slot===part)break;}S.eq[part]=it;}
  S.slots=[slot||null,null,null,null,null];G.recalc();RT.hero.hp=RT.cs.hp;G.resetSkillFx();RT.cds={};
  const MAX=1e15;RT.enemies=Array.from({length:n},(_,i)=>{const e=G.mkEnemy('허수아비',MAX,0,false,i,n);e.hp=low?MAX*.25:MAX;return e;});
  const h0=RT.enemies.reduce((a,e)=>a+e.hp,0);
  for(let t=0;t<60;t+=0.05){G.step(0.05);S.kills=0;}
  return {dmg:h0-RT.enemies.reduce((a,e)=>a+Math.max(0,e.hp),0),atk:RT.cs.atk};
}
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
function measure(slot,branch,gem){const r={};for(const n of [1,3]){const v=[];for(let s=0;s<SEEDS;s++)for(const low of [false,true])v.push(run(1000+s*7919,slot,branch,n,low,gem).dmg);r[n]=avg(v);}return r;}
const base=measure(null,null);
const G0=boot(1);
console.log(`스킬 레벨 ${SL}, 60초 × 시드 ${SEEDS}개, 평타만 쓸 때 화력 = 1`);
console.log('스킬 / 갈래                     1마리   3마리   평균');
const rows=[];
for(const sk of G0.SKILLS){const opts=[null,...((sk.br&&sk.br[0])||[]).map(o=>o.id)];
  for(const b of opts){const m=measure(sk.id,b);const r1=(m[1]-base[1])/base[1],r3=(m[3]-base[3])/base[3];
    const name=`${sk.n}${b?' · '+sk.br[0].find(o=>o.id===b).n:' (갈래 없음)'}`;rows.push({sk:sk.id,b,name,r1,r3,avg:(r1+r3)/2});
    console.log(name.padEnd(26,' '),r1.toFixed(2).padStart(7),r3.toFixed(2).padStart(7),((r1+r3)/2).toFixed(2).padStart(7));}}
const off=rows.filter(r=>!G0.SKMAP[r.sk].sup);
const hi=off.reduce((a,b)=>b.avg>a.avg?b:a),lo=off.reduce((a,b)=>b.avg<a.avg?b:a);
console.log(`\n(피의 서약·전투 함성·방패 돌진은 보조 스킬이라 뺌)\n공격 스킬(갈래 포함) 중 최고 ${hi.name} ${hi.avg.toFixed(2)} / 최저 ${lo.name} ${lo.avg.toFixed(2)} → ${(hi.avg/lo.avg).toFixed(2)}배`);

// 보조 젬 비교 (v0.5.1): 젬 하나(기본 희귀, GEMR=0/1/2)를 맞는 공격 스킬마다 끼워 보고, 같은 스킬에 젬이 없을 때보다 화력이 얼마나 늘었는지
if (G0.GEMS.length && !process.env.NOGEM) {
  console.log(`\n보조 젬 (${['일반','희귀','전설'][+(process.env.GEMR||1)]}) — 맞는 공격 스킬에 끼웠을 때 화력 증가 평균 (갈래 없음)`);
  const plain = {}; for (const sk of G0.SKILLS) if (!sk.sup) { const m = measure(sk.id, null); plain[sk.id] = ((m[1]-base[1])/base[1] + (m[3]-base[3])/base[3]) / 2; }
  const combos = [];
  for (const g of G0.GEMS) { const gains = [];
    for (const sk of G0.SKILLS) { if (sk.sup || !G0.gemOk(g, sk)) continue; const m = measure(sk.id, null, g.id);
      const v = ((m[1]-base[1])/base[1] + (m[3]-base[3])/base[3]) / 2; gains.push(v/plain[sk.id]-1); combos.push({ name: `${sk.n}+${g.n}`, v, util: !!g.util }); }
    console.log(`  ${g.n.padEnd(8,' ')} 맞는 스킬 ${String(gains.length).padStart(2)}개 · 화력 +${(avg(gains)*100).toFixed(0)}% (최소 ${(Math.min(...gains)*100).toFixed(0)}%, 최대 ${(Math.max(...gains)*100).toFixed(0)}%)`); }
  const hi = combos.reduce((a,b)=>b.v>a.v?b:a), lo = combos.reduce((a,b)=>b.v<a.v?b:a);
  console.log(`  스킬+젬 조합 전체: 최고 ${hi.name} ${hi.v.toFixed(2)} / 최저 ${lo.name} ${lo.v.toFixed(2)} → ${(hi.v/lo.v).toFixed(2)}배`);
  const dm = combos.filter(c => !c.util), hi2 = dm.reduce((a,b)=>b.v>a.v?b:a), lo2 = dm.reduce((a,b)=>b.v<a.v?b:a);
  console.log(`  화력 젬끼리(충격·흡혈·처치 시 폭발 제외): 최고 ${hi2.name} ${hi2.v.toFixed(2)} / 최저 ${lo2.name} ${lo2.v.toFixed(2)} → ${(hi2.v/lo2.v).toFixed(2)}배`);
}
