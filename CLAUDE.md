# 잿빛 심연 — 작업 안내

작업을 시작할 때는 이 파일과 `CHANGELOG.md` 맨 위 항목만 읽으면 현재 상태를 알 수 있다.

## 현재 상태
- 최신 버전과 변경 내역: `CHANGELOG.md` (최신이 위)
- 플레이 주소: https://wav04303-hash.github.io/ashen-depth/
- 장르: 디아블로·토치라이트형 아이템 파밍 RPG, 자동 전투 + 빌드 짜기
- 핵심 루프: 자동 사냥 → 장비 드롭 → 비교·장착 → 분해 → 마력석으로 강화/재련 → 보스 돌파 → 다음 지역
- 다음 후보: 성장 곡선 정리(v0.5), 고대 등급, 원소 피해 체계, 균열형 엔드게임, 장비 필터, 보관함, 업적, 정예 몬스터

## 코드 구조
- 게임 전체가 `index.html` 한 파일이다. 앱 설치용으로 `manifest.webmanifest`, `sw.js`(오프라인 캐시), 아이콘 PNG(`tools/make-icons.py`로 생성)가 옆에 있다(v0.4.3).
- 상태는 `S`(`newState()`가 기본값, `applySave()`가 병합), 실행 중 값은 `RT`다.
- 능력치 계산은 `calc()`, 반영은 `recalc()`. 전투 한 틱은 `step(dt)`(0.05초 단위).
- 수치 기준: 스테이지 배율 `sc(st)=1.1^(st-1)`. 몬스터 생명력 30×, 공격력 3×, 보스 생명력 320×. 방어 피해 감소 = 방어도/(방어도+40×배율), 최대 80%.
- 영웅 기본치: 생명력 80+레벨×4, 공격력 5+레벨×0.5 (v0.2).
- 등급(`rarity`): 0 일반, 1 마법, 2 희귀, 3 전설, 4 세트(v0.3). 비용 계산은 `rk(it)`로 세트를 2.5등급으로 친다.
- 세트(v0.4, 6종): guard 파수꾼(평원·생존), rot 썩은 뿌리(숲·흡혈), blade 칼날(묘지·치명타), magma 용암 심장(용암·광역), frost 서리 망령(첨탑·스킬), hunter 사냥꾼(공허·보스). `SETS`(부위·2/4세트 효과), `SET_BY_REGION`(지역마다 하나), `SET_COL`(오라·도감 색), `SET_RATE`(희귀→세트 전환 확률). 드롭은 `rollDrop()`, 세트 효과는 `calc()`에서 `setCounts()`로 적용. 확률·발동형 효과(`dmgTaken`, `reflect`, `critHeal`, `cdReset`, `bossTime`, `bossReset`, v0.4의 `leechMult`(생명력 흡수에 곱), `killHeal`(`kill()`), `blast`(평타 뒤 화염 폭발 확률))는 `calc()` 결과에 실려 `step()`에서 쓰인다.

- 편의(v0.4): `S.autoEquip`/`tryAutoEquip()`(5% 넘게 강하면 장착), `S.setSeen`/`markSeen()`(세트 도감), `RT.invF`(가방 필터: all·up·set·부위), `countUp()`→`RT.upCount`(장비 탭 ▲ 개수).
- 정리 규칙(v0.4.2): `S.sort={on,weak,weakTo,dup,keep[]}`(`sortDefault()`), 판정은 `salvReason(it,{pickup,fresh})`(우선순위: 잠금 > `keep` 옵션 > 도감 새 조각 > dup·weak > 등급별 `S.autoSalv`), 가방 정리는 `sortSweep()`, 30초 주기와 기록 묶음은 `sortTick()`(`step()`에서 호출, `RT.sortT`·`RT.sortAgg`). 테스트: `node tools/tests/sort-rules.mjs`. 

- 그래픽(v0.4.1, 도트): `draw()`가 저해상도 캔버스 `LO`(화면/`PX`=3)에 그리고 키워 붙인다. 스프라이트는 문자열 격자(`HERO_BODY`, `SWORD`, `MON[]`, `DECO`)를 `bake()`로 한 번 구워 `SPRC`에 캐시(테두리·명암 자동). 영웅 동작은 `HERO_POSES`, 적은 `monSprite(지역, 보스, 프레임, 흰색, 공격)`. 이펙트는 `RT.fx`의 `k`로 `FXR[k]`가 그리며, 스킬은 `SKILLS[].fx={t,col}` + `skFx()`. 배경은 `bgCache`·`floorCache`·`vigCache`(지역·크기마다 한 번), `MOBILE`이면 입자 60%.

## 시뮬레이션
- `node tools/sim.mjs [게임 분=30] [시드 수=3]` — `index.html`의 스크립트를 DOM 없이 불러 `step()`을 직접 돌린다. 장비 없음 / 장비 착용(세트 끔) / 세트 착용 세 경우, 같은 레벨 희귀 대비 세트 효과 크기(정적 수치), 전투 측정(같은 부위 희귀와 바꿔 3분 사냥)을 출력한다.
- 환경변수: `MANAGE=60`(장비 정리 주기, 게임 초), `MODES=none,gear,set`, `NOENH=1`(강화 안 함), `NOTAL=1`(특성·스킬 강화 안 함).

## 바꿀 때마다 지킬 것
1. `CHANGELOG.md` 맨 위에 버전 항목을 추가한다.
2. 밸런스를 바꾸면 `step()`을 직접 돌리는 헤드리스 시뮬레이션으로 장비 없음/장비 착용 두 경우를 비교한다.
3. 큰 변경은 브랜치와 PR로 올리고 사용자 확인을 받는다.
4. **`sw.js` 첫 줄의 캐시 이름(`ashen-v0-4-3` 식)을 버전마다 올린다.** 안 올리면 설치한 휴대폰에 옛 버전이 남는다. 헤더의 버전 표시(`v0.x.x`)도 같이 올린다.
