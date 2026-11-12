// 잿빛 심연 헤드리스 시뮬레이터
// 사용법: node tools/sim.mjs [게임 분] [시드 수]
// index.html의 게임 코드를 DOM 없이 불러와 step()을 직접 돌린다.
// 세 경우를 비교한다: 장비 없음 / 장비 착용(세트 끔) / 세트 착용(세트 켬, 세트를 모아 입는 정책)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const MINUTES = +(process.argv[2] || 30);
const SEEDS = +(process.argv[3] || 3);
const MANAGE = +(process.env.MANAGE || 10); // 몇 초(게임 시간)마다 장비를 정리하는지

// 아무 속성이나 받아 주는 가짜 DOM
function stub() {
  const f = function () {};
  return new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'then') return undefined;
      if (!(k in t) || k === 'length' || k === 'name') t[k] = stub();
      return t[k];
    },
    apply() { return stub(); },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EXPORTS = ['RT','step','calc','recalc','genItem','upgradeScore','setCounts','SETS','SET_RATE','SLOTS','TALENTS','SKILLS','xpNeed','slotCount','sc','stageName','salvVal','enhCost'];
function boot(seed) {
  Math.random = mulberry32(seed);
  const doc = stub();
  const win = stub();
  const ls = { getItem: () => null, setItem() {}, removeItem() {} };
  const fn = new Function('document', 'window', 'setInterval', 'setTimeout', 'requestAnimationFrame', 'localStorage', 'navigator',
    code + `
;const __o={get S(){return S}};
for(const k of ${JSON.stringify(EXPORTS)})try{__o[k]=eval(k);}catch(e){}
return __o;`);
  return fn(doc, win, () => 0, () => 0, () => 0, ls, stub());
}

const TAL_ORDER = ['str', 'vit', 'pre', 'cru', 'agi', 'arm', 'foc', 'hun', 'rec', 'luc', 'gre'];

function manage(G, mode) {
  const S = G.S, RT = G.RT;
  // 특성: 우선순위대로, 앞 항목을 조금씩 번갈아 찍음
  let left = process.env.NOTAL ? 0 : S.lvl - 1 - Object.values(S.tal).reduce((a, b) => a + b, 0);
  while (left > 0) {
    const T = TAL_ORDER.map(id => G.TALENTS.find(t => t.id === id)).filter(t => (S.tal[t.id] || 0) < t.max)
      .sort((a, b) => (S.tal[a.id] || 0) - (S.tal[b.id] || 0))[0];
    if (!T) break;
    S.tal[T.id] = (S.tal[T.id] || 0) + 1; left--;
  }
  // 스킬 레벨업: 장착 스킬 중 가장 싼 것
  for (let k = 0; k < (process.env.NOTAL ? 0 : 20); k++) {
    const ids = S.slots.slice(0, G.slotCount()).filter(Boolean);
    const c = id => Math.ceil(40 * Math.pow(1.45, S.skills[id] - 1));
    const id = ids.sort((a, b) => c(a) - c(b))[0];
    if (!id || S.gold < c(id) * 1.5 || S.skills[id] >= 30) break;
    S.gold -= c(id); S.skills[id]++;
  }
  if (mode === 'none') { for (const it of S.inv) S.stones += G.salvVal(it); S.inv = []; G.recalc(); return; }
  // 한 부위씩 더 좋은 것으로 교체
  for (let pass = 0; pass < 7; pass++) {
    let best = null, bs = 1.01;
    for (const it of S.inv) { const sc = G.upgradeScore(it); if (sc > bs) { bs = sc; best = it; } }
    if (!best) break;
    S.inv.splice(S.inv.indexOf(best), 1); const old = S.eq[best.slot]; S.eq[best.slot] = best; if (old) S.inv.push(old); G.recalc();
  }
  // 세트 정책: 가진 세트 조각을 묶어서 입었을 때 더 강하면 통째로 교체
  if (mode === 'set') {
    const score = eq => { const c = G.calc(eq); return c.power * (1 + c.bossDmg / 300) * Math.sqrt(c.ehp); };
    for (const id in G.SETS) {
      const eq = Object.assign({}, S.eq);
      for (const part of G.SETS[id].parts) {
        const cand = S.inv.filter(x => x.set === id && x.slot === part).sort((a, b) => b.ilvl - a.ilvl)[0];
        if (cand) eq[part] = cand;
      }
      if (score(eq) > score(S.eq) * 1.01) {
        for (const part in eq) if (eq[part] !== S.eq[part]) {
          S.inv.splice(S.inv.indexOf(eq[part]), 1); if (S.eq[part]) S.inv.push(S.eq[part]); S.eq[part] = eq[part];
        }
        G.recalc();
      }
    }
  }
  // 정리: 세트 조각과 전설은 남기고 나머지 분해
  S.inv = S.inv.filter(it => {
    if ((mode === 'set' && it.set) || it.rarity === 3) return true;
    S.stones += G.salvVal(it); return false;
  }).slice(-40);
  // 강화: 장착 장비 중 가장 싼 강화
  for (let k = 0; k < (process.env.NOENH ? 0 : 10); k++) {
    const list = Object.values(S.eq).filter(it => it && (it.enh || 0) < 10).sort((a, b) => G.enhCost(a).st - G.enhCost(b).st);
    const it = list[0]; if (!it) break; const c = G.enhCost(it);
    if (S.stones < c.st || S.gold < c.g) break;
    S.stones -= c.st; S.gold -= c.g; it.enh = (it.enh || 0) + 1; G.recalc();
  }
}

function run(mode, seed) {
  const G = boot(seed);
  if (mode === 'gear' && G.SET_RATE) { G.SET_RATE.kill = 0; G.SET_RATE.boss = 0; }
  const T = MINUTES * 60, dt = 0.05; let t = 0, nextM = 0;
  const marks = {};
  while (t < T) {
    G.step(dt); t += dt;
    if (t >= nextM) { manage(G, mode); nextM += MANAGE; }
    for (const m of [10, 30, 60, 120]) if (!marks[m] && t >= m * 60) marks[m] = G.S.maxStage;
  }
  const S = G.S, C = G.RT.cs;
  return { G, maxStage: S.maxStage, lvl: S.lvl, marks, deaths: S.stats.deaths, sets: S.stats.sets, legends: S.stats.legends,
    eqSets: G.setCounts ? G.setCounts(S.eq) : {}, dps: C.dps, ehp: C.ehp };
}

const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const out = {};
const MODES = (process.env.MODES || 'none,gear,set').split(',');
for (const mode of MODES) {
  const rs = []; for (let i = 0; i < SEEDS; i++) rs.push(run(mode, 1000 + i * 7919));
  out[mode] = rs;
  const ms = Object.keys(rs[0].marks).map(m => `${m}분 ${avg(rs.map(r => r.marks[m])).toFixed(1)}`).join(' · ');
  console.log(`[${{ none: '장비 없음', gear: '장비 착용(세트 끔)', set: '세트 착용' }[mode]}] 최고 스테이지 ${rs.map(r => r.maxStage).join('/')} (평균 ${avg(rs.map(r => r.maxStage)).toFixed(1)}) · ${ms} · Lv ${avg(rs.map(r => r.lvl)).toFixed(1)} · 사망 ${avg(rs.map(r => r.deaths)).toFixed(1)}`);
  if (mode === 'set') for (const r of rs) console.log(`   세트 드롭 ${r.sets}개, 착용 세트 ${JSON.stringify(r.eqSets)}`);
}

if (G0ok()) {
// 같은 아이템 레벨의 세트 한 벌로 갈아입으면 얼마나 바뀌는지 (장비 착용 결과 기준)
console.log('\n[세트 효과 크기] 장비 착용 경우의 최종 장비에서, 같은 부위를 같은 레벨의 희귀 장비로 채웠을 때 대비 세트로 채웠을 때');
const base = out.gear[0];
console.log(`  기준: 스테이지 ${base.G.S.maxStage}, 아이템 레벨 ${base.G.S.maxStage}의 세트/희귀 조각을 각 41번 뽑아 중앙값 (나머지 부위는 그대로)`);
const G = base.G; const S = G.S; const ilvl = S.maxStage;
for (const id in G.SETS) {
  const SD = G.SETS[id];
  for (const n of [2, 4]) {
    const P = [], B = [], E = [];
    for (let smp = 0; smp < 41; smp++) {
      const eq = Object.assign({}, S.eq), eqR = Object.assign({}, S.eq);
      for (const part of SD.parts.slice(0, n)) {
        let it; for (let k = 0; k < 500; k++) { it = G.genItem(ilvl, 4, id); if (it.slot === part) break; }
        let rr; for (let k = 0; k < 500; k++) { rr = G.genItem(ilvl, 2); if (rr.slot === part) break; }
        it.enh = rr.enh = eq[part] ? eq[part].enh || 0 : 0; eq[part] = it; eqR[part] = rr;
      }
      const c0 = G.calc(eqR), c1 = G.calc(eq);
      P.push(c1.power / c0.power); B.push(c1.power * (1 + c1.bossDmg / 100) / (c0.power * (1 + c0.bossDmg / 100))); E.push(c1.ehp / c0.ehp);
    }
    const med = a => a.sort((x, y) => x - y)[a.length >> 1];
    const pct = r => ((med(r) - 1) * 100).toFixed(0).padStart(4) + '%';
    console.log(`  ${SD.n} ${n}세트: 화력 ${pct(P)} · 보스 화력 ${pct(B)} · 생존력 ${pct(E)}`);
  }
}
}
function G0ok() { return out.gear && out.gear[0].G.SETS; }
