/**
 * 브라우저 시나리오 점검: 기능 T-01~12와 공통 확인, 구조 개편 인수 조건 U-01~07 (제작 기준 v0.4).
 * 실행: npm run build && npx vite preview --port 4173 --strictPort 를 띄운 뒤 `node e2e/scenario.mjs`
 * Playwright 가 설치된 환경에서만 동작한다 (프로젝트 의존성에는 넣지 않았다).
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

// 전역 설치된 Playwright 도 찾을 수 있게 require 사용 (NODE_PATH=$(npm root -g))
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const SHOTS = process.env.SHOTS_DIR ?? 'e2e/screenshots';
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

/** localStorage 의 원본 데이터로 전체 집계를 계산 (검토 대기/보완 요청/완료/미제출) */
async function counts(page) {
  return page.evaluate(() => {
    const { data } = JSON.parse(localStorage.getItem('crew-prototype/data'));
    const c = { pending_review: 0, revision_requested: 0, completed: 0, not_submitted: 0 };
    for (const m of data.missions)
      for (const t of m.targetIds) {
        const d = data.deliverables.find((x) => x.missionId === m.id && x.memberId === t);
        c[d ? d.status : 'not_submitted']++;
      }
    return [c.pending_review, c.revision_requested, c.completed, c.not_submitted].join('/');
  });
}
async function shown(locator) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
const globalNav = (page) => page.getByRole('navigation', { name: '주 메뉴' });
const crewNav = (page) => page.getByRole('navigation', { name: '크루 메뉴' });
const CREW = { '크루 홈': '크루 홈', 미션: '미션', 커뮤니티: '커뮤니티', '크루 소통': '커뮤니티', 성과: '성과', QnA: 'Q&A게시판' };
/**
 * v0.6 메뉴 이동: 로고(홈) · 크루 활동 펼침(크루 홈·미션·커뮤니티) · 이용 가이드 · 운영 관리(관리자).
 * 크루 업무 화면에서는 크루 메뉴를 쓴다. 알림 예시는 시연 도구 안에서 연다.
 */
async function go(page, name) {
  if (name === '알림 미리보기') {
    await openDemo(page);
    await demo(page).getByRole('button', { name: /^알림 예시/ }).click();
    return;
  }
  if (name === '홈') {
    await page.getByRole('banner').getByRole('button', { name: 'CREW 홈' }).click();
    return;
  }
  // 768px 미만에서는 메뉴 버튼으로 같은 항목을 세로로 펼친다
  const mobileMenu = !(await globalNav(page).isVisible());
  const nav = async () => {
    if (!mobileMenu) return globalNav(page);
    const toggle = page.getByRole('banner').getByRole('button', { name: '메뉴', exact: true });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    return page.getByRole('navigation', { name: '모바일 메뉴' });
  };
  if (name === '운영 관리' || name === '전체 크루' || name === '이용 가이드') {
    await (await nav()).getByRole('button', { name: name === '전체 크루' ? '운영 관리' : name, exact: true }).click();
    return;
  }
  const target = name === '내 크루' ? '크루 홈' : CREW[name];
  // 커뮤니티 안의 게시판: 크루 메뉴는 '커뮤니티' → 탭, 상단 펼침은 게시판 이름으로 바로
  const board = target === '커뮤니티' ? '자유게시판' : target === 'Q&A게시판' ? 'Q&A게시판' : null;
  if (await crewNav(page).count()) {
    await crewNav(page).getByRole('button', { name: board ? '커뮤니티' : target, exact: true }).click();
    if (board === 'Q&A게시판') await page.getByRole('tab', { name: 'Q&A게시판' }).click();
    return;
  }
  const n = await nav();
  if (!mobileMenu) await n.getByRole('button', { name: /크루 활동/ }).click();
  await n.getByRole('button', { name: board ?? target, exact: true }).click();
}
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('crew-prototype/data')).data);

const FOOD = '동네 맛집 첫 장면 숏폼';
const BEAUTY = '데일리 메이크업 60초 릴스';
const demo = (page) => page.getByRole('complementary', { name: '시연 도구' });
/** 접힌 시연 도구를 펼친다 */
async function openDemo(page) {
  const toggle = demo(page).getByRole('button', { name: /시연 도구/ });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}
async function closeDemo(page) {
  const toggle = demo(page).getByRole('button', { name: /시연 도구/ });
  if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click();
}
const USER_IDS = { 민지: 'user-minji', 준호: 'user-junho', 하늘: 'user-haneul', 소라: 'user-sora', 유나: 'user-yuna', 지훈: 'user-jihun', 유진: 'user-yujin', 서연: 'user-seoyeon' };
const ROLE_OF = { 민지: 'member', 준호: 'member', 하늘: 'member', 소라: 'member', 유나: 'member', 지훈: 'leader', 유진: 'leader', 서연: 'admin' };
const ROLE_LABEL = { member: '크루원', leader: '크루장', admin: '관리자' };
/** 지금 로그인한 계정 ID (비로그인이면 null) */
async function currentUserId(page) {
  const acc = page.getByTestId('current-account');
  if (!(await acc.count())) return null;
  const name = (await acc.innerText()).split('·')[0].trim();
  return USER_IDS[name] ?? null;
}
/** 크루 › 미션 목록 → 미션 상세 P-04 */
async function openMission(page, title) {
  await go(page, '미션');
  await page.getByRole('button', { name: `${title} 미션 보기` }).click();
  await page.getByRole('heading', { name: title, level: 1 }).waitFor();
}
/** 미션 목록 → 미션 상세 P-04 → 퀵 리뷰 열기 → 퀵 리뷰 P-05 */
async function openReview(page, title) {
  await openMission(page, title);
  await page.getByRole('button', { name: '퀵 리뷰 열기' }).click();
  await page.getByRole('tab', { name: /검토 대기/ }).waitFor();
}
const crumbs = async (page) =>
  (await page.getByRole('navigation', { name: '현재 위치' }).getByRole('listitem').allInnerTexts()).map((t) => t.trim()).join(' / ');
/** 관리자: 크루 구성원 목록에서 구성원 상세로 */
async function openMember(page, name) {
  await page.getByRole('button', { name: `${name} 개인 보기` }).click();
  await page.getByRole('heading', { name, level: 1 }).waitFor();
}

/**
 * v0.6 시연 로그인으로 계정을 바꾼다: 로그인 중이면 시연 도구 › 다른 계정 체험, 아니면 헤더의 로그인.
 * P-12 에서 역할 → 계정 → 시연 로그인. 성공하면 언제나 홈(P-01)에 도착한다.
 * 이동 전에 미저장 확인 대화상자가 뜨면 그대로 둔다 (호출한 쪽이 처리).
 */
async function pickUser(page, name) {
  if ((await currentUserId(page)) === USER_IDS[name]) return;
  const roleLabel = ROLE_LABEL[ROLE_OF[name]];
  if (await page.getByTestId('current-account').count()) {
    await openDemo(page);
    await demo(page).getByRole('button', { name: /^다른 계정 체험/ }).click();
  } else {
    await page.getByRole('banner').getByRole('button', { name: '로그인', exact: true }).first().click();
  }
  await Promise.race([page.getByRole('heading', { name: '로그인', level: 1 }).waitFor(), page.getByRole('alertdialog').waitFor()]);
  if (await page.getByRole('alertdialog').count()) return;
  await loginAs(page, name);
}
/** P-12 화면에서 역할·계정을 골라 로그인하고 홈 도착을 기다린다 */
async function loginAs(page, name) {
  const roleLabel = ROLE_LABEL[ROLE_OF[name]];
  await page.getByRole('radio', { name: new RegExp(`^${roleLabel}`) }).check();
  await page.getByLabel('시연 계정').selectOption(USER_IDS[name]);
  await page.getByRole('button', { name: '시연 로그인' }).click();
  await page.getByRole('heading', { name: `${name}님, 활동을 이어가세요.` }).waitFor();
}

async function resetData(page) {
  await openDemo(page);
  await demo(page).getByRole('button', { name: '예시 데이터 초기화' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '초기화하기' }).click();
  await page.getByRole('status').getByText('예시 데이터를 처음 상태로 되돌렸어요.').waitFor();
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
// ---------------------------------------------------------------- v0.6 V-01 공개 홈
await page.getByRole('heading', { name: /혼자 만드는 콘텐츠에서/, level: 1 }).waitFor();
check('V-01 처음 열면 공개 홈: 포스터의 큰 제목이 페이지 제목', (await shown(page.getByTestId('hero-poster'))) && (await shown(page.getByRole('heading', { level: 1, name: '혼자 만드는 콘텐츠에서, 함께 성장하는 크루로.' }))));
check('포스터 안 활동 흐름 3단계와 진짜 시작 버튼', (await page.getByRole('list', { name: '크루 활동 흐름' }).getByRole('listitem').allInnerTexts()).map((t) => t.trim()).join('·') === '미션 확인·피드백 나누기·활동 기록 이어가기' && (await shown(page.getByTestId('hero-poster').getByRole('button', { name: '로그인하고 시작하기' }))));
check('포스터와 겹치는 ‘함께 이어가는 활동’ 카드는 없다', (await page.getByRole('heading', { name: '함께 이어가는 활동' }).count()) === 0);
check('V-01 계정 이름·시연 도구·관리 메뉴 없음', (await page.getByTestId('current-account').count()) === 0 && (await demo(page).count()) === 0 && (await globalNav(page).getByRole('button', { name: '운영 관리' }).count()) === 0);
check('V-01 로그인과 가이드가 보인다', (await shown(page.getByRole('banner').getByRole('button', { name: '로그인', exact: true }))) && (await shown(globalNav(page).getByRole('button', { name: '이용 가이드' }))));
check('V-01 크루 내부 기록이 보이지 않는다 (공개 우수 사례 배너 제외)', (await page.evaluate((t) => { const main = document.querySelector('main').cloneNode(true); main.querySelectorAll('[aria-labelledby="showcase-banner-title"]').forEach((e) => e.remove()); return main.textContent.includes(t); }, FOOD)) === false);
check('헤더 로고: TH 심볼 + CREW + by Treasure Hunter', await shown(page.getByRole('banner').getByText('by Treasure Hunter')));
check('푸터: 운영 Treasure Hunter', await shown(page.getByRole('contentinfo').getByRole('img', { name: 'Treasure Hunter' })));
// 비로그인 크루 활동 → 로그인 안내
await go(page, '미션');
check('N-05 비로그인 크루 활동 선택 → 로그인 안내', await shown(page.getByText('크루 활동은 로그인한 크루원·크루장이 이용해요.')));
await page.getByRole('button', { name: '취소' }).click();
check('P-12 취소 → 이전 공개 페이지', await shown(page.getByRole('heading', { name: /혼자 만드는/ })));
// ---------------------------------------------------------------- V-05 가이드
await go(page, '이용 가이드');
await page.getByRole('heading', { name: '이용 가이드', level: 1 }).waitFor();
const tocLinks = await page.getByRole('navigation', { name: '가이드 목차' }).getByRole('link').allInnerTexts();
check('V-05 비로그인 가이드 목차', tocLinks.join('·') === '시작·크루 찾기·미션·피드백·활동 기록·FAQ·크루장 안내', tocLinks.join('·'));
check('V-05 관리자 절차는 비로그인 DOM 에 없다', (await page.locator('#guide-admin').count()) === 0 && !(await page.getByText('관리자 절차').count()));
const allIds = await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="가이드 목차"] a')].every((a) => document.getElementById(a.getAttribute('href').slice(1))));
check('V-05 목차와 섹션 ID 일치', allIds);
await page.getByRole('navigation', { name: '가이드 목차' }).getByRole('link', { name: '피드백' }).click();
await page.waitForTimeout(900);
const fbTop = await page.locator('#guide-feedback').evaluate((e) => e.getBoundingClientRect().top);
check('V-05 목차 선택 → 해당 섹션으로 스크롤', fbTop >= 0 && fbTop < 40, `top=${Math.round(fbTop)}`);
check('V-05 이동한 섹션 제목에 초점', (await page.evaluate(() => document.activeElement?.id)) === 'guide-feedback-title');
await page.getByRole('button', { name: '시연 로그인하기' }).click();
await page.getByRole('heading', { name: '로그인', level: 1 }).waitFor();
check('V-05 가이드 → 로그인', await shown(page.getByText('실제 비밀번호를 입력하지 않아요.')));
// ---------------------------------------------------------------- V-08 로그인 검증
await page.getByRole('button', { name: '시연 로그인' }).click();
check('V-08 계정을 고르지 않으면 로그인하지 않는다', (await shown(page.getByText('시연 계정을 골라 주세요.'))) && (await page.getByTestId('current-account').count()) === 0);
check('V-08 계정 선택 오류에 aria-invalid', (await page.getByLabel('시연 계정').getAttribute('aria-invalid')) === 'true');
await page.getByRole('radio', { name: /^크루장/ }).check();
const leaderOpts = await page.getByLabel('시연 계정').locator('option').allInnerTexts();
check('P-12 역할을 고르면 그 역할 계정만 보인다', leaderOpts.length === 3 && leaderOpts.slice(1).every((t) => /지훈|유진/.test(t)), leaderOpts.join(','));
await loginAs(page, '지훈');
// ---------------------------------------------------------------- V-02 같은 홈
check('V-02 크루장 로그인 → 같은 홈 + 개인 구역', (await shown(page.getByRole('heading', { name: /혼자 만드는/ }))) && (await shown(page.getByRole('heading', { name: '지훈님, 활동을 이어가세요.' }))));
check('시연 도구는 기본으로 접혀 있고 현재 사용자를 보여준다', (await demo(page).getByRole('button', { name: /시연 도구/ }).getAttribute('aria-expanded')) === 'false' && (await shown(page.getByRole('banner').getByText('지훈 · 크루장'))));
check('U-06 퀵 리뷰·알림 미리보기는 전역 메뉴에 없다', (await globalNav(page).getByRole('button', { name: /퀵 리뷰|알림/ }).count()) === 0);
check('크루장 전역 메뉴: 크루 활동 · 받은 제안 · 이용 가이드', (await globalNav(page).getByRole('button').allInnerTexts()).join('·').replace(/\s*▾/, '') === '크루 활동·받은 제안·이용 가이드');
check('크루장 홈: 검토 대기 없으면 빈 안내', await shown(page.getByText('지금 검토할 제출물이 없어요.')));
await globalNav(page).getByRole('button', { name: /크루 활동/ }).click();
check('크루 활동 펼침: 크루 홈 · 미션 · 커뮤니티(자유게시판 · Q&A게시판) · 성과(크루장)', (await globalNav(page).getByRole('list').nth(1).getByRole('button').allInnerTexts()).join('·') === '크루 홈·미션·자유게시판·Q&A게시판·성과' && (await shown(globalNav(page).getByRole('list').nth(1).getByText('커뮤니티', { exact: true }))));
await page.keyboard.press('Escape');
check('크루 활동 펼침 Escape 로 닫고 초점 복귀', (await globalNav(page).getByRole('button', { name: /크루 활동/ }).getAttribute('aria-expanded')) === 'false' && (await page.evaluate(() => document.activeElement?.textContent ?? '')).includes('크루 활동'));
// ---------------------------------------------------------------- U-01 다섯 페이지 연결
check('U-01 홈에 내 크루 바로가기', await shown(page.getByRole('button', { name: '내 크루', exact: true })));
await page.getByRole('button', { name: '내 크루', exact: true }).click();
await page.getByRole('heading', { name: '푸드 A 크루', level: 1 }).waitFor();
check('크루 업무 화면에 카테고리 태그', await shown(page.getByText('카테고리 푸드')));
check('P-02 크루 소개 (사전 등록 데이터)', await shown(page.getByRole('region', { name: '크루 소개' }).getByText(/짧은 음식 콘텐츠/)));
check('P-02 공지가 없으면 공지 요약을 숨긴다', (await page.getByRole('heading', { name: '공지 요약' }).count()) === 0);
check('U-01 크루 홈 P-02 (크루 메뉴: 크루 홈 · 미션 · 커뮤니티 · 성과)', (await crewNav(page).getByRole('button').allInnerTexts()).join('·') === '크루 홈·미션·커뮤니티·성과');
check('U-01 크루 홈에 최근 미션 요약', await shown(page.getByRole('list', { name: '최근 미션' }).getByText(FOOD)));
await page.getByRole('button', { name: /미션 전체 보기/ }).click();
await page.getByRole('heading', { name: '미션', level: 1 }).waitFor();
check('U-01 미션 목록 P-03', (await crumbs(page).catch(() => '')) === '' && (await shown(page.getByRole('table', { name: '미션 목록' }))));
check('P-03 크루장 표: 제출 형식 열', (await page.getByRole('table', { name: '미션 목록' }).getByRole('columnheader').allInnerTexts()).some((t) => t.includes('제출 형식')));
check('P-03 크루장 표: 목표 한 줄 요약', await shown(page.getByRole('table', { name: '미션 목록' }).getByText('첫 3초 안에 대표 메뉴가 보이는 60초 이내 숏폼을 만든다.')));
await page.getByRole('button', { name: `${FOOD} 미션 보기` }).click();
await page.getByRole('button', { name: '퀵 리뷰 열기' }).waitFor();
check('U-01 미션 상세 P-04', (await crumbs(page)) === `푸드 A 크루 / 미션 목록 / ${FOOD}`);
check('P-04 크루장: 대상자·상태 요약 (이름과 상태만)', (await page.getByRole('list', { name: '대상자별 상태' }).getByRole('listitem').count()) === 3);
check('P-04 크루장: 피드백 폼·대기열을 중첩하지 않는다', (await page.getByRole('tab', { name: /검토 대기/ }).count()) === 0 && (await page.getByRole('button', { name: /완료 처리|보완 요청 남기기/ }).count()) === 0);
await page.getByRole('button', { name: '퀵 리뷰 열기' }).click();
await page.getByRole('tab', { name: /검토 대기/ }).waitFor();
check('U-01 퀵 리뷰 P-05', (await crumbs(page)) === `푸드 A 크루 / 미션 목록 / ${FOOD} / 퀵 리뷰`);
check('P-05 머리에 검토 대기 건수', await shown(page.getByRole('main').getByText(/검토 대기 0건/)));
await page.getByRole('button', { name: '미션 상세로 돌아가기' }).click();
check('U-03 미션 상세로 돌아가기', await shown(page.getByRole('button', { name: '퀵 리뷰 열기' })));
await page.getByRole('navigation', { name: '현재 위치' }).getByRole('button', { name: '푸드 A 크루' }).click();
check('U-03 위치 표시로 크루 홈 복귀', await shown(page.getByRole('heading', { name: '푸드 A 크루', level: 1 })));
await go(page, '홈');

check('초기 집계 1/0/1/3', (await counts(page)) === '1/0/1/3', await counts(page));
await page.screenshot({ path: `${SHOTS}/01-leader-missions.png` });

// ---------------------------------------------------------------- T-01
await go(page, '미션');
await page.getByRole('button', { name: '미션 등록' }).first().click();
await page.getByRole('button', { name: '등록하기' }).click();
check('P-06 크루 고정 표시와 위치 표시', (await shown(page.getByText('(고정)'))) && (await crumbs(page)) === '푸드 A 크루 / 미션 목록 / 새 미션');
check('T-01 빈 폼은 등록되지 않는다', await shown(page.getByText('제목을 입력해 주세요.')));
check('T-01 오류 입력에 aria-invalid', (await page.getByLabel('제목').getAttribute('aria-invalid')) === 'true');
await page.getByLabel('제목').fill('T-01 새 미션');
check('T-01 고친 입력의 오류만 지운다', !(await shown(page.getByText('제목을 입력해 주세요.'))) && (await shown(page.getByText('대상자를 한 명 이상 고르세요.'))));
await page.getByLabel('목표·제출 기준').fill('기준입니다');
await page.getByLabel('텍스트').check();
await page.getByLabel('마감 일시').fill('2030-01-10T18:00');
await page.getByLabel('민지').check();
await page.screenshot({ path: `${SHOTS}/02-mission-form.png` });
await page.getByRole('button', { name: '등록하기' }).click();
await page.getByRole('status').getByText('미션을 등록했어요. 대상자 1명에게 보여요.').waitFor();
let data = await stored(page);
const newMission = data.missions.find((m) => m.title === 'T-01 새 미션');
check('T-01 마감 일시를 한국 시간으로 저장', newMission?.dueAt === '2030-01-10T09:00:00.000Z', newMission?.dueAt);
await pickUser(page, '준호');
check('T-01 비대상자(준호)에게 보이지 않는다', !(await page.getByText('T-01 새 미션').count()), `${await page.getByRole('banner').innerText()} | ${await page.locator('h1').first().innerText()} | ${await page.getByText('T-01 새 미션').allInnerTexts()}`);
await pickUser(page, '민지');
check('T-01 대상자(민지)에게 보인다', (await page.getByRole('button', { name: /T-01 새 미션/ }).count()) > 0);
check('T-01 집계 대상 6건, 미제출 4', (await counts(page)) === '1/0/1/4', await counts(page));
await resetData(page);
check('초기화 후 1/0/1/3', (await counts(page)) === '1/0/1/3');

// ---------------------------------------------------------------- T-02
await pickUser(page, '민지');
await page.getByRole('heading', { name: '민지님, 활동을 이어가세요.' }).waitFor();
check('크루원 홈: 미제출 미션이 다음에 할 일에 보인다', await shown(page.getByRole('list', { name: '다음에 할 일' }).getByText(FOOD)));
await page.getByRole('list', { name: '다음에 할 일' }).getByRole('button', { name: `${FOOD} 미션 보기` }).click();
await page.getByRole('heading', { name: FOOD, level: 1 }).waitFor();
check('크루원 미션 상세는 목록 패널 없이 독립 화면', (await page.getByRole('list', { name: '배정된 미션 목록' }).count()) === 0 && (await shown(page.getByRole('navigation', { name: '현재 위치' }))));
await page.screenshot({ path: `${SHOTS}/03-member-not-submitted.png` });
await page.getByRole('button', { name: '제출하기' }).click();
await page.getByRole('button', { name: '제출하기' }).click();
check('T-02 빈 링크는 저장되지 않는다', await shown(page.getByText('영상 링크를 입력해 주세요.')));
await page.getByLabel('영상 링크').fill('example.com/x');
await page.getByRole('button', { name: '제출하기' }).click();
check('T-02 http/https 아닌 주소 거부', await shown(page.getByText('http:// 또는 https:// 로 시작하는 주소를 넣어 주세요.')));

// 미저장 이동 확인: 취소하면 입력 유지
await page.getByLabel('영상 링크').fill('https://example.com/share/minji-v1');
await pickUser(page, '준호');
const dlg = page.getByRole('alertdialog');
check('미저장 이동 시 확인 대화상자', await shown(dlg.getByText('저장하지 않고 이동할까요?')));
check('대화상자 초점은 머무는 쪽 버튼', await dlg.getByRole('button', { name: '계속 작성' }).evaluate((el) => el === document.activeElement));
await page.keyboard.press('Escape');
check('취소하면 입력 유지', (await page.getByLabel('영상 링크').inputValue()) === 'https://example.com/share/minji-v1');
check('V-07 취소하면 계정·세션 유지', (await currentUserId(page)) === 'user-minji');

// 연속 클릭 중복 방지
const submitBtn = page.getByRole('button', { name: '제출하기' });
await submitBtn.click();
await submitBtn.click({ force: true, timeout: 500 }).catch(() => {});
await page.getByRole('status').getByText('제출했어요. 크루장 검토를 기다리고 있어요.').waitFor();
data = await stored(page);
check('T-02 연속 클릭에도 제출 버전 1개', data.versions.filter((v) => v.deliverableId.startsWith('deliverable-') && data.deliverables.find((d) => d.id === v.deliverableId)?.memberId === 'user-minji').length === 1);
check('T-02 집계 2/0/1/2', (await counts(page)) === '2/0/1/2', await counts(page));
check('T-02 기한 후 제출 표시', await page.getByText('기한 후 제출').first().isVisible());
await page.screenshot({ path: `${SHOTS}/04-member-pending.png` });

// ---------------------------------------------------------------- T-03
await pickUser(page, '지훈');
check('크루장 홈: 검토 대기 미션 표시', await shown(page.getByRole('list', { name: '검토를 기다리는 미션' }).getByText(FOOD)));
await page.getByRole('list', { name: '검토를 기다리는 미션' }).getByRole('button', { name: `${FOOD} 미션 보기` }).click();
await page.getByRole('heading', { name: FOOD, level: 1 }).waitFor();
check('홈 바로가기 → 미션 상세 P-04 (퀵 리뷰는 미션에서 연다)', (await crumbs(page)) === `푸드 A 크루 / 미션 목록 / ${FOOD}`, await crumbs(page));
await page.getByRole('button', { name: '퀵 리뷰 열기' }).click();
await page.getByRole('tab', { name: /검토 대기/ }).waitFor();
check('미션 상세 → 퀵 리뷰 P-05', (await crumbs(page)) === `푸드 A 크루 / 미션 목록 / ${FOOD} / 퀵 리뷰`, await crumbs(page));
check('U-03 퀵 리뷰에 미션 상세로 돌아가는 경로', await shown(page.getByRole('button', { name: '미션 상세로 돌아가기' })));
check('퀵 리뷰 기본 필터는 검토 대기', (await page.getByRole('tab', { name: /검토 대기/ }).getAttribute('aria-selected')) === 'true');
check('처리 결과 미선택이면 저장 비활성', await page.getByRole('button', { name: '처리 결과를 고르세요' }).isDisabled());
await page.locator('fieldset label', { hasText: '보완 요청' }).click();
await page.getByRole('button', { name: '보완 요청 남기기' }).click();
check('T-03 빈 수정 방향은 저장되지 않는다', await shown(page.getByText('어떻게 고치면 되는지 적어 주세요.')));
await page.getByRole('button', { name: '첫 장면 문구 넣기' }).click();
check('문구 넣기는 입력란에 삽입', (await page.getByLabel(/수정 방향/).inputValue()).startsWith('첫 장면:'));
await page.getByLabel(/수정 방향/).fill('링크 접근 권한을 확인해 주세요.');

// 저장 실패: 입력 유지, 상태·집계 그대로
await page.evaluate(() => {
  window.__origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
});
await page.getByRole('button', { name: '보완 요청 남기기' }).click();
await page.getByText('저장하지 못했어요. 입력한 내용은 그대로 있어요. 다시 저장해 보세요.').waitFor();
check('저장 실패 띠 role=alert', (await page.getByRole('alert').filter({ hasText: '저장하지 못했어요' }).count()) === 1);
{ const v = await page.getByLabel(/수정 방향/).inputValue(); check('저장 실패 시 입력 유지', v === '링크 접근 권한을 확인해 주세요.', JSON.stringify(v)); }
await page.evaluate(() => { Storage.prototype.setItem = window.__origSetItem; });
check('저장 실패 시 집계 그대로 2/0/1/2', (await counts(page)) === '2/0/1/2');
check('저장 실패 시 상태 칩 그대로', (await page.getByLabel('선택한 제출물').getByText('검토 대기', { exact: true }).count()) > 0);
await page.screenshot({ path: `${SHOTS}/05-save-failed.png` });

await page.getByRole('button', { name: '보완 요청 남기기' }).click();
await page.getByRole('status').getByText('보완 요청을 남겼어요.').waitFor();
check('T-03 집계 1/1/1/2', (await counts(page)) === '1/1/1/2', await counts(page));
check('T-11 처리 결과 읽기 전용 유지', await page.getByText('방금 처리했어요').isVisible());
check('T-11 남은 검토 대기 없음', await page.getByRole('button', { name: '남은 검토 대기 없음' }).isDisabled());
check('처리 후 입력 영역 없음', (await page.getByRole('button', { name: /보완 요청 남기기|완료 처리/ }).count()) === 0);
data = await stored(page);
check('F-11A 알림 예시 1개 생성', data.notifications.filter((n) => n.recipientId === 'user-minji').length === 1);
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOTS}/06-review-processed.png` });
await page.getByRole('tab', { name: /보완 요청/ }).click();
check('필터 이동 시 처리 결과 내려감', !(await page.getByText('방금 처리했어요').isVisible()));
await page.getByRole('tab', { name: /완료/ }).focus();
await page.keyboard.press('ArrowRight');
check('탭 화살표 키 이동', (await page.getByRole('tab', { name: /미제출/ }).getAttribute('aria-selected')) === 'true');

// ---------------------------------------------------------------- T-04
await go(page, '알림 미리보기');
await page.getByText('실제로 보내지 않아요').first().waitFor();
await page.screenshot({ path: `${SHOTS}/07-notification-preview.png` });
await page.getByRole('button', { name: '내 피드백 보기' }).click();
await page.getByRole('heading', { name: '로그인', level: 1 }).waitFor();
check('F-11A 다른 계정이면 자동 전환 없이 로그인 안내', (await currentUserId(page)) === 'user-jihun' && (await shown(page.getByText('받는 사람 계정으로 로그인해야'))));
const notice = await page.getByText('받는 사람 계정으로 로그인해야').innerText();
check('N-03 로그인 안내에 대상 이름·미션 제목을 넣지 않는다', !notice.includes('민지') && !notice.includes(FOOD) && !(await page.getByRole('main').getByText(FOOD).count()));
// 잘못된 계정으로 로그인하면 목적지가 사라진다
await loginAs(page, '준호');
check('V-04 다른 계정(준호)으로 로그인 → 피드백 연결 버튼 없음', (await page.getByRole('button', { name: '선택했던 피드백 보기' }).count()) === 0);
await go(page, '홈');
await pickUser(page, '지훈');
await go(page, '알림 미리보기');
await page.getByRole('button', { name: '내 피드백 보기' }).click();
await page.getByRole('heading', { name: '로그인', level: 1 }).waitFor();
await loginAs(page, '민지');
check('V-04 받는 사람으로 로그인 → 홈 도착 + 선택했던 피드백 보기', (await shown(page.getByRole('heading', { name: /혼자 만드는/ }))) && (await shown(page.getByRole('button', { name: '선택했던 피드백 보기' }))));
await page.getByRole('button', { name: '선택했던 피드백 보기' }).click();
await page.getByText('알림에서 열었어요.').waitFor();
check('T-04 알림 → 로그인 → 홈 → 민지 제출물·피드백', (await currentUserId(page)) === 'user-minji');
await page.getByRole('button', { name: '수정본 제출하기' }).click();
await page.getByLabel('영상 링크').fill('https://example.com/share/minji-v2');
await page.getByRole('button', { name: '수정본 제출하기' }).click();
check('T-04 수정 내용 없이는 재제출 불가', await shown(page.getByText('이전 제출에서 무엇을 바꿨는지 적어 주세요.')));
await page.getByLabel('수정한 내용').fill('공유 권한을 전체 공개로 바꿨어요.');
await page.getByRole('button', { name: '수정본 제출하기' }).click();
await page.getByRole('status').getByText('수정본을 제출했어요.').waitFor();
check('T-04 집계 2/0/1/2', (await counts(page)) === '2/0/1/2', await counts(page));
check('T-04 과거 피드백 유지', await page.getByText('링크 접근 권한을 확인해 주세요.').first().isVisible());
await page.screenshot({ path: `${SHOTS}/08-member-resubmitted.png`, fullPage: true });

// ---------------------------------------------------------------- T-05
await pickUser(page, '지훈');
await openMission(page, FOOD);
check('U-02 크루장 미션 상세는 목록 패널 없이 독립 화면', (await page.getByRole('list', { name: /목록/ }).count()) === 0 && (await crumbs(page)) === `푸드 A 크루 / 미션 목록 / ${FOOD}`);
await page.getByRole('button', { name: '퀵 리뷰 열기' }).click();
await page.getByRole('heading', { name: '2차 제출 검토' }).waitFor();
check('크루장이 1차 피드백과 2차 수정 내용 구별', (await page.getByText('수정한 내용').count()) > 0 && (await page.getByRole('heading', { name: '1차 제출' }).count()) === 1);
await page.locator('fieldset label', { hasText: '완료' }).click();
await page.getByRole('button', { name: '완료 처리' }).click();
await page.getByRole('status').getByText('완료로 처리했어요.').waitFor();
check('T-05 집계 1/0/2/2', (await counts(page)) === '1/0/2/2', await counts(page));
data = await stored(page);
const minjiDel = data.deliverables.filter((d) => d.memberId === 'user-minji');
check('T-05 결과물 1개, 버전 2개', minjiDel.length === 1 && data.versions.filter((v) => v.deliverableId === minjiDel[0].id).length === 2);

// ---------------------------------------------------------------- T-11 빈 필터
await page.getByRole('tab', { name: /보완 요청/ }).click();
check('T-11 빈 필터면 상세도 빈 상태', (await page.getByLabel('선택한 제출물').getByText('보완 요청인 제출물이 없어요').count()) === 1);

// ---------------------------------------------------------------- 구조안 v0.2: 미션 상세 탭 기본값
await go(page, '미션');
check('크루장 미션 목록은 표 형태', await shown(page.getByRole('table', { name: '미션 목록' })));
const foodRow = page.getByRole('table', { name: '미션 목록' }).getByRole('row', { name: new RegExp(FOOD) });
check('표에 상태별 인원 (푸드 A: 검토 대기 0·보완 0·완료 2·미제출 1)', (await foodRow.locator('td .num').allInnerTexts()).join('/') === '3/0/0/2/1', (await foodRow.locator('td .num').allInnerTexts()).join('/'));
await page.screenshot({ path: `${SHOTS}/19-leader-mission-table.png` });
await page.getByRole('button', { name: `${FOOD} 미션 보기` }).click();
await page.getByRole('heading', { name: FOOD, level: 1 }).waitFor();
check('P-04 미션 상세: 기준·현황과 퀵 리뷰 열기', await shown(page.getByRole('button', { name: '퀵 리뷰 열기' })) && (await shown(page.getByRole('heading', { name: '미션 목표·기준' }))));
await page.getByRole('button', { name: '미제출 안내 미리보기 (시연)' }).click();
check('미션 상세에서 미제출 안내 미리보기(시연 도구)로', (await page.getByRole('tab', { name: '미제출 안내' }).getAttribute('aria-selected')) === 'true' && (await shown(page.getByRole('heading', { name: FOOD, level: 2 }))));
await page.screenshot({ path: `${SHOTS}/20-leader-mission-overview.png` });

// ---------------------------------------------------------------- T-10
const seededAt = (await stored(page)).seededAt;
const versionsBefore = JSON.stringify((await stored(page)).versions);
await page.reload();
await page.getByRole('heading', { level: 1 }).first().waitFor();
data = await stored(page);
check('T-10 새로고침 후 예시 날짜·버전 유지', data.seededAt === seededAt && JSON.stringify(data.versions) === versionsBefore);
check('T-10 새로고침 후 집계 유지', (await counts(page)) === '1/0/2/2');
check('V-09 새로고침 후 비로그인 (세션은 메모리에만)', (await currentUserId(page)) === null && (await shown(page.getByRole('heading', { name: /혼자 만드는/ }))));
await pickUser(page, '유진');
await openReview(page, BEAUTY);
check('T-10 다른 크루 사용자면 데이터 범위가 바뀐다', (await page.getByRole('heading', { name: '데일리 메이크업 60초 릴스' }).count()) === 1 && !(await page.getByText('민지').count()));

// 관리자 미구현 표시
await pickUser(page, '서연');
check('V-02 관리자도 로그인 후 같은 홈', await shown(page.getByRole('heading', { name: '서연님, 활동을 이어가세요.' })));
check('관리자 메뉴: 이용 가이드 · 운영 관리 (크루 활동 없음)', (await globalNav(page).getByRole('button').allInnerTexts()).join('·') === '이용 가이드·운영 관리');
await page.getByRole('region', { name: /서연님/ }).getByRole('button', { name: '운영 관리' }).click();
// ---------------------------------------------------------------- 2차: 관리자 집계 (T-02~05 재확인)
await page.getByRole('heading', { name: '운영 관리', level: 1 }).waitFor();
check('운영 관리 제목·탭: 크루 현황 · 대시보드 · 광고 제안', (await page.getByRole('tab').allInnerTexts()).map((t) => t.trim()).join('·') === '크루 현황·대시보드·광고 제안');
// 합계는 크루별 현황 표 맨 아래 행 (미션 배정 건, 검토 대기, 보완 요청, 완료, 미제출)
const totalNums = async () => page.getByRole('table', { name: '크루별 현황' }).locator('tfoot .num').allInnerTexts();
const legendNums = async () => (await totalNums()).slice(1);
check('합계 카드 대신 확인할 것 카드 4개', (await page.getByRole('region', { name: '제출 상태 집계' }).count()) === 0 && (await shown(page.getByRole('heading', { name: '확인할 것' }))) && (await page.locator('[aria-label$="건"]').filter({ hasText: /검토 지연|마감 지난 미제출|보완 요청 후 대기|응답 없는 제안/ }).count()) === 4);
check('확인할 것: 응답 없는 제안 2건 (예시 제안, 3일 전)', await shown(page.getByLabel('응답 없는 제안 2건')));
check('P-09 크루 표: 카테고리·미션 배정·상태 숫자 열', (await page.getByRole('table', { name: '크루별 현황' }).getByRole('columnheader').allInnerTexts()).map((t) => t.trim()).filter((t) => t && t !== '이동').join('·') === '크루·카테고리·미션 배정·검토 대기·보완 요청·완료·미제출');
check('단위 안내: 미션 배정 건 (크루원 1명 × 미션 1개 = 1건)', await shown(page.getByText('(크루원 1명 × 미션 1개 = 1건)')));
check('P-09 크루 필터 기본 항목 이름: 전체 크루', (await page.getByLabel('크루', { exact: true }).locator('option').first().innerText()) === '전체 크루');
check('관리자 집계 T-05 이후 1/0/2/2', (await legendNums()).join('/') === '1/0/2/2', (await legendNums()).join('/'));
check('관리자 합계 행 미션 배정 5건', (await totalNums())[0] === '5');
await page.getByLabel('크루', { exact: true }).selectOption({ label: '푸드 A' });
check('크루 필터 적용 (푸드 A 0/0/2/1)', (await legendNums()).join('/') === '0/0/2/1', (await legendNums()).join('/'));
await page.getByLabel('미션', { exact: true }).selectOption({ label: '동네 맛집 첫 장면 숏폼' });
check('미션 하나로 걸러도 같은 화면은 같은 단위(건)', (await totalNums())[0] === '3' && (await shown(page.getByRole('table', { name: '크루별 현황' }).locator('tfoot').getByText('건', { exact: false }))) && !(await page.getByRole('table', { name: '크루별 현황' }).getByText(/\d+\s*명$/).count()));
await page.getByLabel('기간 시작').fill('2030-01-01');
check('P-09 조회 범위가 0이면 빈 상태와 필터 해제', (await shown(page.getByText('조건에 맞는 대상이 없어요'))) && (await shown(page.getByRole('button', { name: '필터 해제' }))));
await page.getByLabel('기간 끝').fill('2029-01-01');
check('시작일이 종료일보다 늦으면 안내', await shown(page.getByText('시작일이 종료일보다 늦어요. 기간을 다시 확인해 주세요.')));
await page.screenshot({ path: `${SHOTS}/10-admin-overview-filter.png` });
await go(page, '운영 관리');
await page.screenshot({ path: `${SHOTS}/11-admin-overview.png` });

// ---------------------------------------------------------------- T-06 / T-12 게시·성과
await pickUser(page, '민지');
check('크루원 홈: 완료된 미션은 할 일에 없다', await shown(page.getByText('지금 할 일이 없어요')));
await openMission(page, FOOD);
await page.getByRole('button', { name: '게시 기록 남기기' }).click();
await page.getByRole('heading', { name: '게시·성과 기록', level: 1 }).waitFor();
check('P-07 미션 상세의 하위 독립 페이지', (await crumbs(page)) === `푸드 A 크루 / 미션 목록 / ${FOOD} / 게시·성과`, await crumbs(page));
check('P-07 게시 정보 전에는 성과 입력 없음', (await page.getByRole('form', { name: '성과 기록' }).count()) === 0 && (await shown(page.getByText('게시 정보를 먼저 저장하면'))));
await page.getByRole('button', { name: '게시 정보 저장' }).click();
check('게시 기록 필수값 검증', await shown(page.getByText('플랫폼을 고르세요.')) && (await shown(page.getByText('게시 URL을 입력해 주세요.'))));
await page.getByLabel('플랫폼').selectOption('유튜브');
await page.getByLabel('게시 URL').fill('https://example.com/share/minji-v2');
await page.getByLabel('게시일').fill('2026-11-02');
await page.getByRole('button', { name: '게시 정보 저장' }).click();
check('검토용 공유 링크는 게시 URL로 받지 않는다', await shown(page.getByText('검토용 공유 링크와 같은 주소예요. 실제 게시물 주소를 넣어 주세요.')));
await page.getByLabel('게시 URL').fill('https://youtube.example/watch?v=minji');
// T-12: 게시 정보만 저장
await page.getByRole('button', { name: '게시 정보 저장' }).click();
await page.getByRole('status').getByText('게시 정보를 저장했어요.').waitFor();
data = await stored(page);
const minjiPost = (d) => d.posts.find((p) => d.deliverables.find((x) => x.id === p.deliverableId)?.memberId === 'user-minji');
const minjiObs = (d) => d.observations.filter((o) => o.postId === minjiPost(d)?.id);
check('T-12 게시 정보만 저장하면 관찰 기록 없음', !!minjiPost(data) && minjiObs(data).length === 0);
check('게시 후에도 완료 상태 유지', data.deliverables.find((d) => d.memberId === 'user-minji').status === 'completed');
check('게시만 하면 미집계', await shown(page.getByText(/미집계/)));
check('P-07 성과 입력 출처: 수동', await shown(page.getByText('입력 출처:')));
const obsSaved = (n) =>
  page.waitForFunction(
    (k) => {
      const d = JSON.parse(localStorage.getItem('crew-prototype/data')).data;
      const post = d.posts.find((p) => d.deliverables.find((x) => x.id === p.deliverableId)?.memberId === 'user-minji');
      return d.observations.filter((o) => o.postId === post?.id).length === k && document.querySelector('[name="more-views"]')?.value === '';
    },
    n,
  );
await page.getByRole('form', { name: '성과 기록' }).getByLabel('확인일').fill('2026-11-08');
await page.getByRole('form', { name: '성과 기록' }).getByLabel('조회수').fill('-3');
await page.getByRole('button', { name: '성과 기록 저장' }).click();
check('음수 조회수 거부', await shown(page.getByText('0 이상의 정수로 입력하거나 비워 두세요.')));
// T-06: 조회수 0
await page.getByRole('form', { name: '성과 기록' }).getByLabel('확인일').fill('2026-11-01');
await page.getByRole('form', { name: '성과 기록' }).getByLabel('조회수').fill('0');
await page.getByRole('button', { name: '성과 기록 저장' }).click();
check('게시일보다 이른 확인일 거부', await shown(page.getByText('확인일은 게시일(11월 2일)보다 빠를 수 없어요.')));
await page.getByRole('form', { name: '성과 기록' }).getByLabel('확인일').fill('2026-11-08');
await page.getByRole('button', { name: '성과 기록 저장' }).click();
await obsSaved(1);
data = await stored(page);
check('T-12 조회수 0이면 관찰 기록 생성', minjiObs(data).length === 1 && minjiObs(data)[0].views === 0);
// 같은 확인일 수정, 다른 확인일 추가
await page.getByRole('form', { name: '성과 기록' }).getByLabel('확인일').fill('2026-11-08');
check('같은 확인일 수정 안내', await shown(page.getByText('11월 8일 기록이 이미 있어요. 저장하면 그 기록을 고쳐요.')));
await page.getByRole('form', { name: '성과 기록' }).getByLabel('조회수').fill('0');
await page.getByRole('form', { name: '성과 기록' }).getByLabel('회고').fill('첫 장면 반응을 다음 주에 다시 확인할게요.');
await page.getByRole('button', { name: '성과 기록 저장' }).click();
await page.waitForFunction(() => {
  const d = JSON.parse(localStorage.getItem('crew-prototype/data')).data;
  return d.observations.some((o) => o.checkedOn === '2026-11-08' && o.retrospective !== '');
});
data = await stored(page);
check('T-12 같은 확인일은 수정', minjiObs(data).length === 1 && minjiObs(data)[0].retrospective !== '', JSON.stringify(minjiObs(data)));
check('P-07 과거 확인일별 기록 표', (await page.getByRole('table', { name: '확인일별 성과 기록' }).getByRole('row').count()) === 2);
await page.screenshot({ path: `${SHOTS}/12-member-post.png`, fullPage: true });
await page.getByRole('button', { name: '미션 상세로 돌아가기' }).click();
await page.getByRole('heading', { name: FOOD, level: 1 }).waitFor();
check('P-04 완료: 게시·성과 요약과 하위 페이지 이동 버튼', (await shown(page.getByRole('heading', { name: '게시·성과 요약' }))) && (await shown(page.getByRole('button', { name: '게시·성과 기록' }))));

await pickUser(page, '서연');
await go(page, '운영 관리');
await page.getByRole('button', { name: '푸드 A 구성원 보기' }).click();
await page.getByRole('heading', { name: '푸드 A 크루 구성원' }).waitFor();
check('P-09 크루를 고르면 같은 페이지 아래에 구성원', (await shown(page.getByRole('heading', { name: '운영 관리', level: 1 }))) && (await shown(page.getByRole('table', { name: '푸드 A 구성원 목록' }))));
check('P-09 고른 크루 행 표시', (await page.getByRole('button', { name: '푸드 A 구성원 보기' }).getAttribute('aria-current')) === 'true');
check('P-09 구성원 줄에 제안 건수 열 없음', !(await page.getByRole('table', { name: '푸드 A 구성원 목록' }).getByRole('columnheader').allInnerTexts()).some((t) => t.includes('제안')));
await openMember(page, '민지');
{
  const crumbs = (await page.getByRole('navigation', { name: '현재 위치' }).getByRole('listitem').allInnerTexts()).map((t) => t.trim());
  check('관리자 개인 상세 위치: 운영 관리 / 푸드 A 크루 / 민지', crumbs.join(' / ') === '운영 관리 / 푸드 A 크루 / 민지', crumbs.join(' / '));
}
await page.getByRole('tab', { name: '콘텐츠 성과' }).click();
check('T-06 관리자 성과에 0회', await shown(page.getByRole('tabpanel').getByText('0', { exact: true })) && (await shown(page.getByRole('tabpanel').getByText('회', { exact: true }))));
check('T-06 확인일·수동 입력 표시', await shown(page.getByRole('tabpanel').getByText('확인일 11월 8일')) && (await shown(page.getByRole('tabpanel').getByText('수동 입력'))));
check('T-06 게시 URL 연결', await shown(page.getByRole('tabpanel').getByRole('link', { name: /youtube.example/ })));
await page.screenshot({ path: `${SHOTS}/13-admin-performance.png` });
await page.getByRole('navigation', { name: '현재 위치' }).getByRole('button', { name: '푸드 A 크루' }).click();
await page.getByRole('heading', { name: '푸드 A 크루 구성원' }).waitFor();
await openMember(page, '준호');
await page.getByRole('tab', { name: '콘텐츠 성과' }).click();
check('준호는 예시 게시 기록의 조회수(1,240회)', await shown(page.getByRole('tabpanel').getByText('1,240')));
await page.getByRole('navigation', { name: '현재 위치' }).getByRole('button', { name: '푸드 A 크루' }).click();
await openMember(page, '민지');
await page.getByRole('tab', { name: '활동' }).click();
check('관리자 활동에 1·2차 제출과 피드백', (await page.getByRole('tabpanel').getByRole('heading', { name: '1차 제출' }).count()) === 1 && (await page.getByRole('tabpanel').getByRole('heading', { name: '2차 제출' }).count()) === 1);

// ---------------------------------------------------------------- T-07 제안 (6-B: 제안 보내기 → 수락 → 진행 기록)
await page.getByRole('tab', { name: /광고·커머스 제안/ }).click();
check('진행 기록 없음 빈 상태', await shown(page.getByText('진행 기록이 없어요')));
await page.getByRole('button', { name: '이 크루원에게 새 제안 보내기' }).click();
await page.getByRole('heading', { name: '새 광고 제안' }).waitFor();
check('6-B 개인 상세에서 열면 받는 사람이 미리 골라져 있다', (await shown(page.getByText('선택한 사람 1명'))) && (await shown(page.getByRole('button', { name: '민지 빼기' }))));
// 크루를 펼쳐야 그 크루의 크루원이 보인다
check('6-B 받는 사람: 크루를 펼치기 전에는 크루원 목록이 없다', (await page.getByRole('group', { name: '푸드 A 크루원' }).count()) === 0);
await page.getByRole('button', { name: /뷰티 B 크루/ }).click().catch(() => {});
await page.getByLabel(/카테고리 ‘푸드’ 크루만 보기/).uncheck();
await page.getByRole('button', { name: /뷰티 B 크루/ }).click();
check('6-B 크루를 펼치면 그 크루 크루원만', (await page.getByRole('group', { name: '뷰티 B 크루원' }).getByRole('checkbox').allInnerTexts()).length >= 0 && (await page.getByRole('group', { name: '뷰티 B 크루원' }).getByLabel('소라').count()) === 1 && (await page.getByRole('group', { name: '뷰티 B 크루원' }).getByLabel('민지').count()) === 0);
await page.getByRole('group', { name: '뷰티 B 크루원' }).getByLabel('이 크루 전체 선택').check();
check('6-B 이 크루 전체 선택 → 선택한 사람 모음', await shown(page.getByText('선택한 사람 3명')));
await page.getByRole('button', { name: '소라 빼기' }).click();
await page.getByRole('button', { name: '유나 빼기' }).click();
check('6-B ✕로 빼기', await shown(page.getByText('선택한 사람 1명')));
await page.getByRole('button', { name: /제안 보내기/ }).click();
check('6-B 제안 필수값 검증', (await shown(page.getByText('브랜드명을 입력해 주세요.'))) && (await shown(page.getByText('광고 형식을 고르세요.'))) && (await shown(page.getByText('단가는 0 이상의 정수(원)로 입력해 주세요.'))));
await page.getByLabel('브랜드명').fill('식품 브랜드 A');
await page.getByLabel('제품명').fill('신제품 소스');
await page.getByLabel('카테고리', { exact: true }).selectOption('푸드');
await page.getByLabel('제품 설명').fill('신제품 소개 숏폼 1편 제작 가능 여부 확인.');
await page.getByLabel('브랜디드 콘텐츠').check();
await page.getByLabel('단가(원)').fill('500,000');
await page.getByLabel('희망 업로드 일자').fill('2030-01-20');
await page.getByLabel(/^비고/).fill('1월 15일까지 촬영 가능');
await page.getByLabel(/내부 메모/).fill('단가 협의 전. 11월 둘째 주 촬영 일정 확인 필요.');
await page.getByRole('button', { name: '제안 보내기 (1명)' }).click();
await page.getByRole('status').getByText('제안을 보냈어요.', { exact: false }).waitFor();
check('6-B 보낸 제안 상세: 받는 사람별 응답 대기 + 내부 메모(관리자)', (await shown(page.getByRole('table', { name: '받는 사람별 응답' }).getByText('응답 대기'))) && (await shown(page.getByText('단가 협의 전.', { exact: false }))));
await pickUser(page, '민지');
await page.getByRole('banner').getByRole('button', { name: /^알림/ }).click();
await page.getByRole('list', { name: '알림 목록' }).getByRole('button', { name: /^새 제안.*식품 브랜드 A/ }).click();
const myOffer = page.getByRole('article', { name: '식품 브랜드 A 신제품 소스 제안' });
check('6-B 크루원: 알림 → 받은 제안, 단가·업로드일·비고, 내부 메모 비노출', (await shown(myOffer.getByText('500,000원'))) && (await shown(myOffer.getByText('1월 15일까지 촬영 가능'))) && !(await page.content()).includes('단가 협의 전'));
await myOffer.getByLabel('거절').check();
await myOffer.getByRole('button', { name: '응답 보내기' }).click();
await page.getByRole('alertdialog').getByRole('button', { name: '거절하기' }).click();
check('6-B 거절은 사유 필수', await shown(myOffer.getByText('거절 사유를 고르세요.')));
await myOffer.getByLabel('수락').check();
await myOffer.getByRole('button', { name: '응답 보내기' }).click();
await page.getByRole('alertdialog').getByRole('button', { name: '수락하기' }).click();
await page.getByRole('status').getByText('제안을 수락했어요.', { exact: false }).waitFor();
check('6-B 수락 후 응답 폼이 사라지고 철회 불가 안내', (await myOffer.getByRole('button', { name: '응답 보내기' }).count()) === 0 && (await shown(myOffer.getByText(/응답 후에는 바꿀 수 없어요/))));
await pickUser(page, '서연');
await page.getByRole('banner').getByRole('button', { name: /^알림/ }).click();
await page.getByRole('list', { name: '알림 목록' }).getByRole('button', { name: /^제안 응답.*민지.*수락/ }).click();
check('6-B 관리자 알림 → 보낸 제안 상세(수락)', await shown(page.getByRole('table', { name: '받는 사람별 응답' }).getByText('수락')));
check('6-B 응답이 있으면 조건 수정 잠금', await page.getByRole('button', { name: '조건 수정' }).isDisabled());
await page.getByRole('table', { name: '받는 사람별 응답' }).getByRole('button', { name: '진행·수익 기록' }).click();
await page.getByRole('tab', { name: /광고·커머스 제안/ }).waitFor();
check('저장 후 내부 메모 표시(관리자)', await shown(page.getByText('내부 메모, 관리자에게만 보여요').first()));
const statusSelect = page.getByRole('article').first().getByLabel('진행 상태');
check('같은 상태면 저장 비활성', await page.getByRole('button', { name: '지금과 같은 상태' }).first().isDisabled());
await statusSelect.selectOption({ label: '진행 확정' });
await page.getByRole('button', { name: '상태 저장' }).click();
await page.getByRole('status').getByText('상태를 ‘진행 확정’으로 바꿨어요.').waitFor();
data = await stored(page);
{
  const mp7 = data.proposals.filter((p) => p.creatorId === 'user-minji');
  check('T-07 수락으로 생긴 진행 기록, 이력 2건', mp7.length === 1 && !!mp7[0].offerId && mp7[0].history.length === 2 && mp7[0].status === 'confirmed', JSON.stringify(mp7.map((p) => [p.status, p.history.length])));
}
await page.getByText(/변경 이력 2건/).click();
await page.screenshot({ path: `${SHOTS}/14-admin-proposals.png`, fullPage: true });
await pickUser(page, '지훈');
const html = await page.content();
check('T-07 크루장 화면에 내부 메모·제안 없음', !html.includes('단가 협의 전') && !html.includes('식품 브랜드 A'));
for (const screen of ['홈', '미션', '알림 미리보기']) {
  await go(page, screen);
  const h = await page.content();
  if (h.includes('단가 협의 전') || h.includes('내부 메모')) check(`T-07 크루장 ${screen}에 내부 메모 없음`, false);
}
await pickUser(page, '민지');
check('T-07 크루원 화면에 내부 메모 없음', !(await page.content()).includes('단가 협의 전'));
await pickUser(page, '서연');
await go(page, '운영 관리');
await go(page, '알림 미리보기');
check('관리자는 담당 크루 알림 예시를 본다', (await page.getByRole('list', { name: '알림 예시 목록' }).getByRole('listitem').count()) === 3);

// ---------------------------------------------------------------- 3차: F-11B 미제출 안내 미리보기
await page.getByRole('tab', { name: '미제출 안내' }).click();
await page.getByRole('button', { name: /데일리 메이크업/ }).click();
await page.getByRole('button', { name: '미제출 안내 미리보기' }).click();
check('F-11B 관리자: 담당 크루(뷰티 B) 미제출 유나', await shown(page.getByText(/대상\s*1\s*명: 유나/)));
check('F-11B 발송 완료 문구 없음', !(await page.content()).includes('발송 완료') && !(await page.content()).includes('보냈어요'));
await pickUser(page, '지훈');
await go(page, '알림 미리보기');
await page.getByRole('tab', { name: '미제출 안내' }).click();
check('F-11B 크루장은 자기 크루 미션만', (await page.getByRole('list', { name: '미션 목록' }).getByRole('listitem').count()) === 1);
await page.getByRole('button', { name: '미제출 안내 미리보기' }).click();
check('F-11B 푸드 A: 완료 2명 빼고 하늘만', await shown(page.getByText(/대상\s*1\s*명: 하늘/)));
await page.screenshot({ path: `${SHOTS}/16-unsubmitted-preview.png` });

// ---------------------------------------------------------------- 3차: T-09 대상자 전용 미션 + T-08 커뮤니티
await go(page, '미션');
await page.getByRole('button', { name: '미션 등록' }).first().click();
await page.getByLabel('제목').fill('민지 전용 촬영 미션');
await page.getByLabel('목표·제출 기준').fill('민지만 대상인 시연용 미션');
await page.getByLabel('텍스트').check();
await page.getByLabel('마감 일시').fill('2030-02-01T18:00');
await page.getByLabel('민지').check();
await page.getByRole('button', { name: '등록하기' }).click();
await page.getByRole('status').getByText('미션을 등록했어요. 대상자 1명에게 보여요.').waitFor();
await go(page, '알림 미리보기');
await page.getByRole('tab', { name: '미제출 안내' }).click();
await page.getByRole('button', { name: /민지 전용 촬영 미션/ }).click();
await page.getByRole('button', { name: '미제출 안내 미리보기' }).click();
check('F-11B 마감 전이면 대상 0명', await shown(page.getByText('지금 안내할 대상이 없어요')) && (await shown(page.getByText(/대상 0명 \(아직 마감 전이에요\)/))));

await go(page, '커뮤니티');
check('P-08 커뮤니티 빈 상태', await shown(page.getByText('아직 올라온 글이 없어요')) && (await shown(page.getByRole('heading', { name: '커뮤니티', level: 1 }))));
await page.getByRole('button', { name: '글쓰기' }).first().click();
const leaderKinds = await page.getByRole('group', { name: '글 구분' }).getByRole('radio').evaluateAll((els) => els.map((e) => e.parentElement.textContent.trim()));
check('6-A 커뮤니티 크루장 글 구분: 공지·글 (질문은 QnA)', leaderKinds.join('·') === '공지·글', leaderKinds.join('·'));
await page.getByRole('button', { name: '올리기' }).click();
check('글 필수값 검증', await shown(page.getByText('글 구분을 고르세요.')) && (await shown(page.getByText('제목을 입력해 주세요.'))));
await page.getByLabel('공지', { exact: true }).check();
await page.getByLabel('제목').fill('이번 주 촬영 팁 모음');
await page.getByLabel('본문').fill('자연광에서 촬영하면 음식 색이 잘 살아요.');
await page.getByLabel(/관련 미션/).selectOption({ label: '민지 전용 촬영 미션' });
await page.getByRole('button', { name: '올리기' }).click();
await page.getByRole('status').getByText('글을 올렸어요.').waitFor();
check('크루장 화면: 연결 미션 열기 가능', await shown(page.getByRole('button', { name: '미션 열기' })));
check('P-08 글을 올리면 목록 자리에 글 상세 (병렬 목록 없음)', (await page.getByRole('list', { name: '크루 글 목록' }).count()) === 0 && (await shown(page.getByRole('heading', { name: '이번 주 촬영 팁 모음', level: 1 }))));
await page.getByRole('button', { name: '목록으로' }).click();
check('P-08 목록으로 돌아가기', await shown(page.getByRole('list', { name: '크루 글 목록' })));

await pickUser(page, '하늘');
await go(page, '커뮤니티');
await page.getByRole('button', { name: /이번 주 촬영 팁/ }).click();
check('T-09 비대상(하늘)은 글을 읽는다', await shown(page.getByRole('heading', { name: '이번 주 촬영 팁 모음' })));
check('T-09 비대상은 잠금 표시와 비활성 버튼', await shown(page.getByText('대상자 전용 미션')) && (await page.getByRole('button', { name: '열 수 없음' }).isDisabled()));
check('T-09 비대상에게 미션 제목이 보이지 않음', !(await page.content()).includes('민지 전용 촬영 미션'));
await page.getByRole('button', { name: '목록으로' }).click();
await page.getByRole('button', { name: '글쓰기' }).first().click();
check('크루원 커뮤니티 글 작성: 공지·질문 구분 없음(글만)', (await page.getByLabel('공지', { exact: true }).count()) === 0 && (await page.getByLabel('질문', { exact: true }).count()) === 0);
await page.getByRole('button', { name: '취소' }).click();
// 6-A: 질문은 QnA 게시판에서
await go(page, 'QnA');
await page.getByRole('heading', { name: '커뮤니티', level: 1 }).waitFor();
check('커뮤니티 탭: 자유게시판 · Q&A게시판 (전체 크루 게시판 탭은 아직 없음)', (await page.getByRole('tablist', { name: '커뮤니티 게시판' }).getByRole('tab').allInnerTexts()).map((t) => t.trim()).join('·') === '자유게시판·Q&A게시판' && (await page.getByRole('tab', { name: 'Q&A게시판' }).getAttribute('aria-selected')) === 'true');
check('Q&A게시판에서도 크루 메뉴는 커뮤니티가 현재', (await crewNav(page).getByRole('button', { name: '커뮤니티' }).getAttribute('aria-current')) === 'page');
await page.getByRole('button', { name: '질문하기' }).first().click();
await page.getByLabel('제목').fill('자막 글꼴 정해진 게 있나요?');
await page.getByLabel('질문 내용').fill('가게 이름 자막에 쓸 글꼴이 궁금해요.');
await page.getByRole('button', { name: '올리기' }).click();
await page.getByRole('status').getByText('질문을 올렸어요.', { exact: false }).waitFor();
await page.getByRole('button', { name: '댓글 달기' }).click();
check('빈 댓글은 저장되지 않는다', await shown(page.getByText('댓글 내용을 입력해 주세요.')));
await page.screenshot({ path: `${SHOTS}/17-community-member.png` });

await pickUser(page, '준호');
await go(page, '커뮤니티');
const titles = await page.getByRole('list', { name: '크루 글 목록' }).getByRole('listitem').allInnerTexts();
check('6-A 커뮤니티에는 공지·글만 (질문은 QnA)', titles.length === 1 && titles[0].includes('이번 주 촬영 팁'), JSON.stringify(titles));
await page.getByRole('button', { name: '글쓰기' }).first().click();
await page.getByLabel('제목').fill('오늘 찍은 비빔국수 첫 장면 공유해요');
await page.getByLabel('본문').fill('자연광 팁대로 찍어 봤어요.');
await page.getByRole('button', { name: '올리기' }).click();
await page.getByRole('status').getByText('글을 올렸어요.').waitFor();
await page.getByRole('button', { name: '목록으로' }).click();
const titles2 = await page.getByRole('list', { name: '크루 글 목록' }).getByRole('listitem').allInnerTexts();
check('P-08 공지는 강조 표시, 일반 글은 구분 표시 없음, 공지가 위', titles2.length === 2 && titles2[0].startsWith('공지') && titles2[1].startsWith('오늘 찍은 비빔국수'), JSON.stringify(titles2));
check('P-08 목록 정보는 | 기호로 구분 (작성자 | 날짜 | 시각 | 댓글)', /\|[\s\S]*\|[\s\S]*\|[\s\S]*댓글/.test(titles2[0]) && !/, /.test(titles2[0]));
await go(page, 'QnA');
await page.getByRole('button', { name: /자막 글꼴/ }).click();
await page.getByLabel('댓글 쓰기').fill('공지에 있던 기본 글꼴을 써요.');
await page.getByRole('button', { name: '댓글 달기' }).click();
await page.getByRole('status').getByText('댓글을 달았어요.').waitFor();
await pickUser(page, '하늘');
await go(page, 'QnA');
check('T-08 목록에 댓글 수', await shown(page.getByRole('button', { name: /자막 글꼴.*댓글 1/ })));
await page.getByRole('button', { name: /자막 글꼴/ }).click();
check('T-08 같은 크루 다른 사용자가 댓글을 본다', await shown(page.getByText('공지에 있던 기본 글꼴을 써요.')));

await go(page, '크루 홈');
check('크루 홈 공지 요약에 공지가 보인다', await shown(page.getByRole('list', { name: '최근 공지' }).getByText('이번 주 촬영 팁 모음')));
check('크루 홈에 다른 사람 제출·피드백이 노출되지 않는다', !(await page.content()).includes('링크 접근 권한을 확인해 주세요'));
await pickUser(page, '민지');
await go(page, '커뮤니티');
await page.getByRole('button', { name: /이번 주 촬영 팁/ }).click();
await page.getByRole('button', { name: '미션 열기' }).click();
check('T-08 대상자는 관련 미션으로 이동', await shown(page.getByRole('heading', { name: '민지 전용 촬영 미션', level: 1 })));

await pickUser(page, '소라');
await go(page, '커뮤니티');
check('T-08 다른 크루(소라)에는 글이 섞이지 않는다', await shown(page.getByText('아직 올라온 글이 없어요')) && !(await page.content()).includes('촬영 팁'));
await pickUser(page, '서연');
await go(page, '운영 관리');
check('관리자 메뉴: 이용 가이드 · 운영 관리 (크루 활동·크루 메뉴 없음)', (await globalNav(page).getByRole('button').allInnerTexts()).join('·') === '이용 가이드·운영 관리' && (await crewNav(page).count()) === 0);

// ---------------------------------------------------------------- v0.6 2단계: 크루원 화면·알림 예시·가이드 버튼
await pickUser(page, '민지');
await go(page, '미션');
check('P-03 크루원 카드: 목표 요약', await shown(page.getByRole('list', { name: '미션 목록' }).getByText('첫 3초 안에 대표 메뉴가 보이는 60초 이내 숏폼을 만든다.')));
await page.getByRole('button', { name: `${FOOD} 미션 보기` }).click();
await page.getByRole('heading', { name: FOOD, level: 1 }).waitFor();
const order = await page.getByRole('heading', { level: 2 }).allInnerTexts();
const iCrit = order.indexOf('미션 목표와 제출 기준');
const iHist = order.indexOf('제출·피드백 이력');
check('P-04 크루원: 목표·기준이 이력보다 먼저', iCrit >= 0 && iHist > iCrit, order.join(' > '));
await go(page, '알림 미리보기');
check('F-11 크루원 알림 예시: 미제출 안내 탭 없음', (await page.getByRole('tab', { name: '미제출 안내' }).count()) === 0);
const memberNotes = await page.getByRole('list', { name: '알림 예시 목록' }).getByRole('listitem').allInnerTexts();
check('F-11 크루원은 본인 알림만', memberNotes.length > 0 && memberNotes.every((t) => t.startsWith('민지')), memberNotes.join(' | '));
await page.getByRole('button', { name: '내 피드백 보기' }).click();
await page.getByText('알림에서 열었어요.').waitFor();
check('F-11A 같은 계정이면 바로 해당 P-04 피드백으로', (await currentUserId(page)) === 'user-minji' && (await shown(page.getByRole('heading', { name: FOOD, level: 1 }))));
await go(page, '이용 가이드');
await page.getByRole('button', { name: '내 할 일 보기' }).click();
await page.getByRole('heading', { name: '미션', level: 1 }).waitFor();
check('가이드 실제 버튼 → 같은 이동·필터 (내 할 일)', (await page.getByRole('tab', { name: /내 할 일/ }).getAttribute('aria-selected')) === 'true');

// ---------------------------------------------------------------- v0.6 4.5단계: 알림함·내 제안·우수 사례
{
  // 크루원 알림함
  const bell = page.getByRole('banner').getByRole('button', { name: /^알림/ });
  check('알림함 버튼에 안 읽은 개수', /안 읽은 알림 \d+개/.test((await bell.getAttribute('aria-label')) ?? ''), await bell.getAttribute('aria-label'));
  await bell.click();
  await page.getByRole('heading', { name: '알림', level: 1 }).waitFor();
  const notes = await page.getByRole('list', { name: '알림 목록' }).getByRole('listitem').allInnerTexts();
  check('크루원 알림: 새 미션·피드백·공지', notes.some((t) => t.startsWith('새 미션')) && notes.some((t) => t.startsWith('피드백')) && notes.some((t) => t.startsWith('공지')), notes.slice(0, 4).join(' / '));
  check('크루원 알림에 제출·질문 알림 없음', !notes.some((t) => t.startsWith('새 제출') || t.startsWith('질문')));
  await page.waitForFunction(() => !/안 읽은/.test(document.querySelector('header button[aria-label^="알림"]')?.getAttribute('aria-label') ?? 'x'));
  check('알림함을 열면 안 읽은 개수가 사라진다', (await bell.getAttribute('aria-label')) === '알림');
  await page.getByRole('list', { name: '알림 목록' }).getByRole('button', { name: /^피드백/ }).first().click();
  check('알림 → 해당 미션의 피드백으로 이동', await shown(page.getByText('알림에서 열었어요.')));
  // 내 제안 (민지: T-07에서 협의 중으로 바뀐 제안)
  await globalNav(page).getByRole('button', { name: '내 제안' }).click();
  await page.getByRole('heading', { name: '내 제안', level: 1 }).waitFor();
  check('내 제안: 수락한 제안은 응답 버튼 없이 진행 상황만', (await shown(page.getByRole('article', { name: '식품 브랜드 A 신제품 소스 제안' }).getByText(/진행 상황: 진행 확정/))) && (await page.getByRole('article', { name: '식품 브랜드 A 신제품 소스 제안' }).getByRole('button').count()) === 0);
  check('내 제안: 내부 메모 비노출', !(await page.content()).includes('단가 협의 전'));
  // 크루장: 우수 사례 지정, 내 제안 메뉴 없음, 알림 종류
  await pickUser(page, '지훈');
  check('크루장에게 내 제안 메뉴 없음', (await globalNav(page).getByRole('button', { name: '내 제안' }).count()) === 0);
  await page.getByRole('banner').getByRole('button', { name: /^알림/ }).click();
  const leaderNotes = await page.getByRole('list', { name: '알림 목록' }).getByRole('listitem').allInnerTexts();
  check('크루장 알림: 새 제출·수정본·질문', leaderNotes.some((t) => t.startsWith('새 제출')) && leaderNotes.some((t) => t.startsWith('수정본')) && leaderNotes.some((t) => t.startsWith('질문')), leaderNotes.slice(0, 4).join(' / '));
  await openMission(page, FOOD);
  check('P-04 크루장: 준호 결과물은 이미 소개 중', await shown(page.getByLabel('준호 우수 사례').getByText('우수 사례로 소개 중')));
  await page.getByRole('button', { name: '민지 우수 사례로 소개' }).click();
  await page.getByRole('button', { name: '소개하기' }).click();
  check('한 줄 평 없이는 지정되지 않는다', await shown(page.getByText('한 줄 평을 입력해 주세요.')));
  await page.getByLabel('한 줄 평').fill('수정 방향을 정확히 반영한 두 번째 버전이에요.');
  await page.getByRole('button', { name: '소개하기' }).click();
  await page.getByRole('status').getByText('우수 사례로 소개했어요.', { exact: false }).waitFor();
  // 공개 홈 배너 → 우수 사례 페이지 (비로그인)
  await page.getByRole('banner').getByRole('button', { name: '로그아웃' }).click();
  const banner = page.getByRole('region', { name: /민지 ·/ });
  check('홈 배너: 가장 최근 우수 사례(민지)와 한 줄 평', (await shown(banner)) && (await shown(banner.getByText('수정 방향을 정확히 반영한'))));
  await page.getByRole('button', { name: '우수 사례 보기' }).click();
  await page.getByRole('heading', { name: '우수 사례', level: 1 }).waitFor();
  const cards = page.getByRole('article');
  check('우수 사례 페이지(공개): 2건, 시연용 가상 사례 표시', (await cards.count()) === 2 && (await cards.first().getByText('시연용 가상 사례').count()) === 1);
  check('우수 사례: 실제 게시 URL·조회수·한 줄 평', (await shown(page.getByRole('link', { name: /youtube.example\/shorts\/junho/ }))) && (await shown(page.getByText('1,240'))) && (await shown(page.getByText('지훈 크루장의 한 줄 평').first())));
  await page.screenshot({ path: `${SHOTS}/21-showcases.png`, fullPage: true });
  // 관리자: 알림(검토 지연), 개인 상세에서 지정 상태
  await pickUser(page, '서연');
  await page.getByRole('banner').getByRole('button', { name: /^알림/ }).click();
  const adminNotes = await page.getByRole('list', { name: '알림 목록' }).getByRole('listitem').allInnerTexts();
  check('관리자 알림: 검토 지연', adminNotes.some((t) => t.startsWith('검토 지연')), adminNotes.join(' / '));
  // 크루원 준호: 예시 제안 확인
  await pickUser(page, '준호');
  await globalNav(page).getByRole('button', { name: '내 제안' }).click();
  check('준호 내 제안: 제안 전달 상태의 예시 제안', (await shown(page.getByText('동네 분식 밀키트 (가상)'))) && (await shown(page.getByText('제안 전달'))) && !(await page.content()).includes('단가는 다음 주'));
}

// ---------------------------------------------------------------- 5단계: 내 성과·크루 성과 관리·대시보드·수익 기록
{
  // 크루원 준호: 내 성과 (예시 수익 기록 300,000원 지급 완료)
  await globalNav(page).getByRole('button', { name: '내 성과' }).click();
  await page.getByRole('heading', { name: '내 성과', level: 1 }).waitFor();
  check('5단계 내 성과: 완료율·조회수 요약', (await shown(page.getByText('100').first())) && (await shown(page.getByText('1,240').first())));
  check('5단계 내 성과: 조회수 추이 그래프', (await page.getByRole('img', { name: /조회수 추이/ }).count()) === 1);
  check('5단계 내 성과: 수익 기록(정산 아님)', (await shown(page.getByRole('table', { name: '수익 기록' }).getByText('300,000원'))) && (await shown(page.getByText('정산·지급 처리가 아니에요.'))));
  await page.getByRole('button', { name: '표로 보기' }).first().click();
  check('그래프 표로 보기', await shown(page.getByRole('table', { name: /조회수 추이.* 표/ })));
  // 관리자: 대시보드 탭, 수익 기록 입력
  await pickUser(page, '서연');
  await go(page, '운영 관리');
  await page.getByRole('tab', { name: '대시보드' }).click();
  const titles5 = await page.getByRole('tabpanel').getByRole('heading', { level: 3 }).allInnerTexts();
  check('5단계 관리자 대시보드: 완료율·수익·주차 상태·제안 단계', ['크루별 미션 완료율', '월별 수익 기록 합계', '주차별 제출 상태 (전체 크루)', '제안 단계별 건수'].every((t) => titles5.includes(t)), titles5.join(' / '));
  check('관리자 대시보드: 순위 표시 없음', !(await page.getByRole('tabpanel').innerText()).includes('순위:') && !(await page.getByText(/^\d+위/).count()));
  await page.getByRole('tab', { name: '크루 현황' }).click();
  await page.getByRole('button', { name: '푸드 A 구성원 보기' }).click();
  await openMember(page, '준호');
  await page.getByRole('tab', { name: /광고·커머스 제안/ }).click();
  check('수익 기록은 진행 확정·종료 제안에만', (await page.getByRole('form', { name: /수익 기록/ }).count()) === 1);
  const revForm = page.getByRole('form', { name: '을지로 국숫집 (가상) 수익 기록' });
  await revForm.getByLabel('금액(원)').fill('-5');
  await revForm.getByRole('button', { name: /수익 기록/ }).click();
  check('수익 금액 검증', await shown(revForm.getByText('금액은 0 이상의 정수(원)로 입력하거나 비워 두세요.')));
  await revForm.getByLabel('금액(원)').fill('350,000');
  await revForm.getByLabel('지급 예정').check();
  await revForm.getByRole('button', { name: /수익 기록/ }).click();
  await page.getByRole('status').getByText('수익 기록을 저장했어요.', { exact: false }).waitFor();
  data = await stored(page);
  check('수익 기록: 제안 1건에 하나(고쳐 쓰기)', data.revenues.length === 1 && data.revenues[0].amount === 350000 && data.revenues[0].payStatus === 'scheduled');
  // 7일 지난 게시물로 바꿔 기록 요청을 시연 (예시 시각 조정)
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('crew-prototype/data'));
    const p = raw.data.posts.find((x) => x.id === 'post-junho-1');
    const old = new Date(Date.now() - 10 * 86400000 + 9 * 3600000).toISOString().slice(0, 10);
    p.publishedOn = old;
    raw.data.observations = raw.data.observations.filter((o) => o.postId !== 'post-junho-1');
    localStorage.setItem('crew-prototype/data', JSON.stringify(raw));
  });
  await page.reload();
  await page.getByRole('heading', { name: /혼자 만드는/ }).waitFor();
  await pickUser(page, '지훈');
  await go(page, '성과');
  await page.getByRole('heading', { name: '크루 성과 관리', level: 1 }).waitFor();
  check('크루장 성과: 기록 요청 필요 표시', await shown(page.getByRole('table', { name: '크루원 성과' }).getByRole('row', { name: /준호/ }).getByText('기록 요청 필요')));
  check('크루장 성과: 수익·제안 비노출', !(await page.content()).includes('을지로 국숫집') && !(await page.content()).includes('350,000'));
  await page.getByRole('button', { name: '준호에게 성과 기록 요청' }).click();
  await page.getByRole('status').getByText('성과 기록을 요청했어요', { exact: false }).waitFor();
  check('기록 요청 후 같은 날 다시 요청 불가', await page.getByRole('button', { name: '준호 오늘 요청함' }).isDisabled());
  data = await stored(page);
  check('기록 요청 1건 저장', data.recordRequests.length === 1 && data.recordRequests[0].memberId === 'user-junho');
  await page.getByRole('tab', { name: '대시보드' }).click();
  check('크루장 대시보드: 주차별 상태·조회수 추이', (await shown(page.getByRole('heading', { name: '주차별 제출 상태', level: 3 }))) && (await shown(page.getByRole('heading', { name: '조회수 합계 추이', level: 3 }))));
  await page.screenshot({ path: `${SHOTS}/22-leader-dashboard.png`, fullPage: true });
  await page.getByRole('tab', { name: '크루원 성과' }).click();
  await page.getByRole('button', { name: '준호 성과 보기' }).click();
  check('크루장의 크루원 보기(읽기 전용): 제안 탭 없음', (await shown(page.getByRole('heading', { name: '준호 성과', level: 1 }))) && (await page.getByRole('tab', { name: /제안/ }).count()) === 0);
  // 크루원: 알림 → 게시·성과 기록, 내 성과에 '기록 요청 받음'
  await pickUser(page, '준호');
  await page.getByRole('banner').getByRole('button', { name: /^알림/ }).click();
  await page.getByRole('list', { name: '알림 목록' }).getByRole('button', { name: /^성과 기록 요청/ }).click();
  check('알림 → 게시·성과 기록 페이지', await shown(page.getByRole('heading', { name: '게시·성과 기록', level: 1 })));
  await globalNav(page).getByRole('button', { name: '내 성과' }).click();
  check('내 성과: 기록 요청 받음 표시', await shown(page.getByText('기록 요청 받음')));
  await page.screenshot({ path: `${SHOTS}/23-member-performance.png`, fullPage: true });
  const ov5 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('내 성과 가로 넘침 없음', ov5 <= 0, `overflow=${ov5}`);
}

// ---------------------------------------------------------------- 6-A: 미션 현황 숫자·재촉·마감 임박·QnA 비공개·수정/삭제
{
  const kstLocal = (ms) => new Date(Date.now() + ms + 9 * 3600000).toISOString().slice(0, 16);
  await pickUser(page, '지훈');
  // 상태 숫자 → 퀵 리뷰 필터
  await openMission(page, FOOD);
  check('6-A 미션 상세: 막대 없이 상태별 숫자', (await page.getByRole('main').getByRole('img').count()) === 0 && (await shown(page.getByRole('group', { name: '상태별 인원' }))));
  await page.getByRole('button', { name: /^미제출 \d+명 보기$/ }).click();
  await page.getByRole('tab', { name: /미제출/ }).waitFor();
  check('6-A 숫자 누르면 그 상태의 크루원(퀵 리뷰 미제출 필터)', (await page.getByRole('tab', { name: /미제출/ }).getAttribute('aria-selected')) === 'true');
  await go(page, '미션');
  await page.getByRole('button', { name: new RegExp(`^${FOOD} 완료 \\d+명 보기$`) }).click();
  await page.getByRole('tab', { name: /완료/ }).waitFor();
  check('6-A 미션 목록 표의 숫자도 해당 상태로 이동', (await page.getByRole('tab', { name: /완료/ }).getAttribute('aria-selected')) === 'true');
  // 마감 임박 미션 등록 (20시간 뒤 마감, 하늘)
  await go(page, '미션');
  await page.getByRole('button', { name: '미션 등록' }).first().click();
  await page.getByLabel('제목').fill('내일 마감 짧은 리뷰');
  await page.getByLabel('목표·제출 기준').fill('마감 임박 알림 확인용');
  await page.getByLabel('텍스트').check();
  await page.getByLabel('마감 일시').fill(kstLocal(20 * 3600000));
  await page.getByLabel('하늘').check();
  await page.getByRole('button', { name: '등록하기' }).click();
  await page.getByRole('status').getByText('미션을 등록했어요.', { exact: false }).waitFor();
  await openMission(page, '내일 마감 짧은 리뷰');
  check('6-A 재촉 상자: 미제출자 이름', await shown(page.getByRole('region', { name: /아직 제출하지 않은 크루원 1명/ }).getByText(/하늘/)));
  await page.getByRole('button', { name: '재촉 알림 보내기' }).click();
  await page.getByRole('status').getByText('1명에게 재촉 알림을 보냈어요.').waitFor();
  check('6-A 재촉은 같은 미션 하루 한 번', await page.getByRole('button', { name: '오늘 보냈어요' }).isDisabled());
  await pickUser(page, '하늘');
  await page.getByRole('banner').getByRole('button', { name: /^알림/ }).click();
  const hNotes = await page.getByRole('list', { name: '알림 목록' }).getByRole('listitem').allInnerTexts();
  check('6-A 하늘 알림: 마감 임박(자동)·제출 재촉', hNotes.some((t) => t.startsWith('마감 임박')) && hNotes.some((t) => t.startsWith('제출 재촉')), hNotes.slice(0, 4).join(' / '));
  // QnA 비공개 질문
  await pickUser(page, '민지');
  await go(page, 'QnA');
  await page.getByRole('button', { name: '질문하기' }).first().click();
  await page.getByLabel('제목').fill('제 촬영 장비 괜찮을까요?');
  await page.getByLabel('질문 내용').fill('폰 하나로 찍고 있어요.');
  await page.getByLabel(/비공개 질문/).check();
  await page.getByRole('button', { name: '올리기' }).click();
  await page.getByRole('status').getByText('질문을 올렸어요.', { exact: false }).waitFor();
  await page.getByRole('button', { name: '수정' }).click();
  await page.getByLabel('제목').fill('제 촬영 장비(폰) 괜찮을까요?');
  await page.getByRole('button', { name: '고친 내용 저장' }).click();
  await page.getByRole('status').getByText('글을 고쳤어요.').waitFor();
  check('6-A 작성자 글 수정 → 수정됨 표시', (await shown(page.getByRole('heading', { name: '제 촬영 장비(폰) 괜찮을까요?', level: 1 }))) && (await shown(page.getByText('수정됨').first())));
  await pickUser(page, '준호');
  await go(page, 'QnA');
  check('6-A 비공개 질문은 다른 크루원에게 안 보인다', !(await page.content()).includes('촬영 장비'));
  await pickUser(page, '지훈');
  await go(page, 'QnA');
  check('6-A 크루장은 비공개 질문을 본다 (비공개 표시)', await shown(page.getByRole('button', { name: /촬영 장비.*/ }).getByText('비공개')));
  check('6-A 크루장은 QnA 에 질문하기 버튼이 없다', (await page.getByRole('button', { name: '질문하기' }).count()) === 0);
  await page.getByRole('button', { name: /촬영 장비/ }).click();
  await page.getByLabel('답변 쓰기').fill('폰으로 충분해요. 자연광만 챙겨 주세요.');
  await page.getByRole('button', { name: '댓글 달기' }).click();
  await page.getByRole('status').getByText('댓글을 달았어요.').waitFor();
  await pickUser(page, '서연');
  await go(page, '운영 관리');
  await page.getByRole('button', { name: '푸드 A 구성원 보기' }).click();
  await page.getByRole('button', { name: /이 크루 Q&A게시판 보기/ }).click();
  await page.getByRole('button', { name: /촬영 장비/ }).click();
  check('6-A 관리자는 비공개 질문을 읽기만 한다', (await shown(page.getByText('폰으로 충분해요.'))) && (await page.getByRole('form', { name: '댓글 달기' }).count()) === 0);
  await pickUser(page, '민지');
  await page.getByRole('banner').getByRole('button', { name: /^알림/ }).click();
  await page.getByRole('list', { name: '알림 목록' }).getByRole('button', { name: /^Q&A게시판 답변/ }).first().click();
  check('6-A 내 질문 답변 알림 → 질문으로 이동, 답변 뒤에는 수정 잠금', (await shown(page.getByText('크루장 답변'))) && (await page.getByRole('button', { name: '수정' }).isDisabled()));
  // 커뮤니티 글 삭제 (댓글 있으면 삭제된 글로)
  await pickUser(page, '준호');
  await go(page, '커뮤니티');
  await page.getByRole('button', { name: /오늘 찍은 비빔국수/ }).click();
  await page.getByLabel('댓글 쓰기').fill('제가 써도 지울 수 있는지 볼게요');
  await page.getByRole('button', { name: '댓글 달기' }).click();
  await page.getByRole('status').getByText('댓글을 달았어요.').waitFor();
  await page.getByRole('button', { name: '삭제', exact: true }).first().click();
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제하기' }).click();
  await page.getByRole('status').getByText('글을 삭제했어요.').waitFor();
  check('6-A 댓글 있는 글 삭제 → 삭제된 글로 남음', await shown(page.getByText('작성자가 삭제한 글이에요.')));
  await page.getByRole('button', { name: '삭제', exact: true }).first().click();
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제하기' }).click();
  await page.getByRole('status').getByText('댓글을 삭제했어요.').waitFor();
  check('6-A 내 댓글 삭제 → 삭제된 댓글로 남음', await shown(page.getByText('삭제된 댓글이에요.')));
  await go(page, '크루 홈');
  check('6-A 크루 홈 맨 위 크루장 공지 강조', await shown(page.getByRole('region', { name: /크루장 공지/ })));
  await go(page, '홈');
  check('6-A 로그인 홈에 최근 공지 한 줄', await shown(page.getByRole('button', { name: /^공지 이번 주 촬영 팁/ })));
}

// ---------------------------------------------------------------- 6-B: 무응답 다시 알림·크루장 전달/추천/대리 응답·추천으로 보내기·취소
{
  await pickUser(page, '서연');
  await go(page, '운영 관리');
  await page.getByRole('tab', { name: '광고 제안' }).click();
  check('6-B 보낸 제안 목록: 응답 없음 표시', await shown(page.getByRole('table', { name: '보낸 제안 목록' }).getByRole('row', { name: /비빔국수 밀키트/ }).getByText(/응답 없음/)));
  await page.getByRole('button', { name: '동네 분식 (가상) · 비빔국수 밀키트' }).click();
  check('6-B 2일 무응답 안내', await shown(page.getByText('하늘님이 2일간 답이 없었어요. 다시 알릴까요?')));
  await page.getByRole('button', { name: '하늘에게 다시 알림' }).click();
  await page.getByRole('status').getByText('다시 알렸어요.', { exact: false }).waitFor();
  check('6-B 다시 알림은 하루 한 번', (await page.getByRole('button', { name: '하늘에게 다시 알림' }).count()) === 0 && (await page.getByRole('button', { name: '오늘 다시 알림' }).first().isDisabled()));
  await pickUser(page, '하늘');
  await page.getByRole('banner').getByRole('button', { name: /^알림/ }).click();
  await page.getByRole('list', { name: '알림 목록' }).getByRole('button', { name: /^제안 다시 알림/ }).click();
  const hOffer = page.getByRole('article', { name: '동네 분식 (가상) 비빔국수 밀키트 제안' });
  await hOffer.getByLabel('거절').check();
  await hOffer.getByLabel('기타(직접 입력)').check();
  await hOffer.getByRole('button', { name: '응답 보내기' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '거절하기' }).click();
  check('6-B 기타 사유는 직접 입력 필수', await shown(hOffer.getByText('기타 사유를 적어 주세요.')));
  await hOffer.getByLabel('기타 사유').fill('촬영 장비 수리 중이에요');
  await hOffer.getByRole('button', { name: '응답 보내기' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '거절하기' }).click();
  await page.getByRole('status').getByText('제안을 거절했어요.').waitFor();
  // 크루장: 받은 제안 (전달 기록·추천·대리 응답, 모두 여러 명)
  await pickUser(page, '지훈');
  await globalNav(page).getByRole('button', { name: '받은 제안' }).click();
  await page.getByRole('heading', { name: '받은 제안', level: 1 }).waitFor();
  check('6-B 크루장은 크루원에게 직접 간 제안을 보지 않는다', !(await page.content()).includes('비빔국수 밀키트') && !(await page.content()).includes('식품 브랜드 A'));
  const lOffer = page.getByRole('article', { name: '로컬 소스 (가상) 고추장 소스 3종 제안' });
  const fwd = lOffer.getByRole('form', { name: '전달 기록' });
  await fwd.getByLabel('민지').check();
  await fwd.getByLabel('하늘').check();
  await fwd.getByRole('button', { name: '전달 기록 남기기' }).click();
  await page.getByRole('status').getByText('전달 기록을 남겼어요.').waitFor();
  check('6-B 전달 기록(여러 명)', await shown(fwd.getByText('민지, 하늘에게 카카오톡으로 전달')));
  const rec = lOffer.getByRole('form', { name: '크루원 추천' });
  await rec.getByLabel('하늘').check();
  await rec.getByLabel('준호').check();
  await rec.getByLabel('추천 사유').fill('소스 활용 레시피 경험');
  await rec.getByRole('button', { name: '추천 보내기' }).click();
  await page.getByRole('status').getByText('추천을 보냈어요.', { exact: false }).waitFor();
  const proxy = lOffer.getByRole('form', { name: '크루장 대리 응답' });
  await proxy.getByLabel('수락').check();
  await proxy.getByLabel('민지').check();
  await proxy.getByRole('button', { name: '크루장으로 응답하기' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '수락하기' }).click();
  await page.getByRole('status').getByText('제안을 수락했어요.', { exact: false }).waitFor();
  data = await stored(page);
  check('6-B 대리 수락 → 고른 크루원(민지) 진행 기록', data.proposals.some((p) => p.offerId === 'offer-2' && p.creatorId === 'user-minji'));
  // 관리자: 추천 확인 → 고른 크루원에게 보내기, 그리고 취소
  await pickUser(page, '서연');
  await page.getByRole('banner').getByRole('button', { name: /^알림/ }).click();
  await page.getByRole('list', { name: '알림 목록' }).getByRole('button', { name: /^크루원 추천/ }).click();
  check('6-B 대리 응답이 관리자 화면에 진행 크루원과 함께', await shown(page.getByRole('table', { name: '받는 사람별 응답' }).getByText('진행: 민지')));
  await page.getByRole('button', { name: /고른 크루원에게 이 제안 보내기 \(2명\)/ }).click();
  await page.getByRole('status').getByText('같은 조건으로 제안을 보냈어요.', { exact: false }).waitFor();
  data = await stored(page);
  const fromRec = data.offers.find((o) => o.sourceOfferId === 'offer-2');
  check('6-B 추천으로 보낸 새 제안: 크루원 2명, 같은 조건', !!fromRec && fromRec.recipientType === 'member' && data.offerRecipients.filter((r) => r.offerId === fromRec.id).length === 2 && fromRec.price === 200000);
  await page.getByRole('tab', { name: '광고 제안' }).click();
  await page.getByRole('button', { name: '동네 분식 (가상) · 비빔국수 밀키트' }).click();
  await page.getByRole('button', { name: '제안 취소' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '제안 취소' }).click();
  await page.getByRole('status').getByText('제안을 취소했어요.').waitFor();
  check('6-B 취소해도 기록은 남는다 (취소됨)', await shown(page.getByRole('heading', { level: 2 }).getByText('취소됨')));
  await pickUser(page, '민지');
  await page.getByRole('banner').getByRole('button', { name: /^알림/ }).click();
  await page.getByRole('list', { name: '알림 목록' }).getByRole('button', { name: /^제안 취소/ }).click();
  check('6-B 받는 사람: 제안 취소 알림 → 응답할 수 없음', (await shown(page.getByText('회사가 이 제안을 취소했어요.'))) && (await page.getByRole('article', { name: '동네 분식 (가상) 비빔국수 밀키트 제안' }).getByRole('button', { name: '응답 보내기' }).count()) === 0);
  await page.screenshot({ path: `${SHOTS}/24-member-offers.png`, fullPage: true });
}

// ---------------------------------------------------------------- 모바일
const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true });
const mp = await mobile.newPage();
await mp.goto(BASE);
await mp.evaluate(() => localStorage.clear());
await mp.reload();
await pickUser(mp, '민지');
await openMission(mp, FOOD);
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('375px 가로 넘침 없음', overflow <= 0, `overflow=${overflow}`);
await mp.getByRole('button', { name: '제출하기' }).click();
const btnBox = await mp.getByRole('button', { name: '제출하기' }).boundingBox();
check('375px 버튼 높이 44px 이상', btnBox && btnBox.height >= 44, btnBox && `h=${btnBox.height}`);
await mp.screenshot({ path: `${SHOTS}/09-mobile-member.png`, fullPage: true });
await pickUser(mp, '서연');
await go(mp, '운영 관리');
await mp.getByRole('heading', { name: '운영 관리', level: 1 }).waitFor();
const ovAdmin = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('375px 관리자 전체 크루 가로 넘침 없음', ovAdmin <= 0, `overflow=${ovAdmin}`);
await mp.getByRole('button', { name: '푸드 A 구성원 보기' }).click();
await mp.getByRole('heading', { name: '푸드 A 크루 구성원' }).waitFor();
const ovMembers = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('375px 구성원 목록 가로 넘침 없음', ovMembers <= 0, `overflow=${ovMembers}`);
await openMember(mp, '민지');
await mp.getByRole('tab', { name: /광고·커머스 제안/ }).click();
const ovCrew = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('375px 크리에이터 상세 가로 넘침 없음', ovCrew <= 0, `overflow=${ovCrew}`);
await mp.screenshot({ path: `${SHOTS}/15-mobile-admin.png`, fullPage: true });
await pickUser(mp, '하늘');
await go(mp, '커뮤니티');
await mp.getByRole('button', { name: '글쓰기' }).first().click();
const ovComm = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('375px 커뮤니티 가로 넘침 없음', ovComm <= 0, `overflow=${ovComm}`);
const writeBtn = await mp.getByRole('button', { name: '올리기' }).boundingBox();
check('375px 올리기 버튼 44px 이상', writeBtn && writeBtn.height >= 44);
await mp.screenshot({ path: `${SHOTS}/18-mobile-community.png`, fullPage: true });
const mp320 = await (await browser.newContext({ viewport: { width: 320, height: 700 } })).newPage();
await mp320.goto(BASE);
await pickUser(mp320, '지훈');
await openReview(mp320, FOOD);
const ov320 = await mp320.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('320px 가로 넘침 없음', ov320 <= 0, `overflow=${ov320}`);

// ---------------------------------------------------------------- 구조 개편: 390·1280 이동·반응형
const LONG = '긴 제목 확인용: 동네 시장 골목 맛집 세 곳을 하루에 돌며 첫 장면 3초 안에 대표 메뉴를 보여주는 60초 숏폼 시리즈 1편';
for (const width of [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const wp = await ctx.newPage();
  wp.on('pageerror', (e) => consoleErrors.push(String(e)));
  await wp.goto(BASE);
  await wp.evaluate(() => localStorage.clear());
  await wp.reload();
  const ov = () => wp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const clipped = () =>
    wp.evaluate(() =>
      [...document.querySelectorAll('h1, h3, button, time, [role="alert"], label')].filter(
        (el) => el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible',
      ).length,
    );
  // V-10 공개 홈·가이드·로그인: 넘침 없음, 메뉴·로그인 찾기
  await wp.getByRole('heading', { name: /혼자 만드는/ }).waitFor();
  check(`V-10 ${width}px 공개 홈 넘침 없음`, (await ov()) <= 0 && (await clipped()) === 0, `overflow=${await ov()}`);
  check(`V-10 ${width}px 헤더에 로그인 버튼`, await shown(wp.getByRole('banner').getByRole('button', { name: '로그인', exact: true })));
  if (width < 768) {
    const toggle = wp.getByRole('banner').getByRole('button', { name: '메뉴' });
    await toggle.click();
    const mnav = wp.getByRole('navigation', { name: '모바일 메뉴' });
    const items = (await mnav.getByRole('button').allInnerTexts()).join('·');
    check(`V-10 ${width}px 메뉴 펼침: 홈·크루 활동 항목·이용 가이드`, items === '홈·크루 홈·미션·자유게시판·Q&A게시판·이용 가이드', items);
    check(`V-10 ${width}px 메뉴 버튼 aria-expanded`, (await toggle.getAttribute('aria-expanded')) === 'true');
    await wp.keyboard.press('Escape');
    check(`V-10 ${width}px Escape 로 메뉴 닫힘`, (await wp.getByRole('navigation', { name: '모바일 메뉴' }).count()) === 0);
  }
  await go(wp, '이용 가이드');
  await wp.getByRole('heading', { name: '이용 가이드', level: 1 }).waitFor();
  check(`V-10 ${width}px 가이드 넘침 없음`, (await ov()) <= 0, `overflow=${await ov()}`);
  const tocBox = await wp.getByRole('navigation', { name: '가이드 목차' }).boundingBox();
  check(`V-10 ${width}px 가이드 목차가 화면 안에서 줄바꿈`, !!tocBox && tocBox.x >= 0 && tocBox.x + tocBox.width <= width);
  await wp.getByRole('banner').getByRole('button', { name: '로그인', exact: true }).click();
  await wp.getByRole('heading', { name: '로그인', level: 1 }).waitFor();
  check(`V-10 ${width}px 로그인 넘침 없음`, (await ov()) <= 0, `overflow=${await ov()}`);
  await wp.screenshot({ path: `${SHOTS}/v06-login-${width}.png`, fullPage: true });
  await loginAs(wp, '지훈');
  check(`V-10 ${width}px 로그인 홈 넘침 없음`, (await ov()) <= 0 && (await clipped()) === 0, `overflow=${await ov()}`);
  await wp.screenshot({ path: `${SHOTS}/v06-home-leader-${width}.png`, fullPage: true });
  // 크루장: 긴 제목 미션 등록 → 퀵 리뷰로 연결
  await go(wp, '미션');
  await wp.getByRole('button', { name: '미션 등록' }).first().click();
  await wp.getByLabel('제목').fill(LONG);
  await wp.getByLabel('목표·제출 기준').fill('긴 제목이 목록·상세·퀵 리뷰에서 잘리지 않는지 확인');
  await wp.getByLabel('텍스트').check();
  await wp.getByLabel('마감 일시').fill('2030-03-01T18:00');
  await wp.getByLabel('전체 선택').check();
  await wp.getByRole('button', { name: '등록하기' }).click();
  await wp.getByRole('tab', { name: /검토 대기/ }).waitFor();
  check(`${width}px 등록 후 해당 미션 퀵 리뷰`, (await crumbs(wp)).endsWith(`${LONG} / 퀵 리뷰`), await crumbs(wp));
  check(`${width}px 퀵 리뷰 가로 넘침 없음`, (await ov()) <= 0, `overflow=${await ov()}`);
  await wp.getByRole('tab', { name: /미제출/ }).click();
  await wp.screenshot({ path: `${SHOTS}/w${width}-review.png`, fullPage: true });
  await go(wp, '미션');
  check(`${width}px 크루장 미션 목록 가로 넘침 없음`, (await ov()) <= 0);
  check(`${width}px 긴 제목 카드 잘림 없음`, (await clipped()) === 0, `clipped=${await clipped()}`);
  await wp.screenshot({ path: `${SHOTS}/w${width}-leader-list.png`, fullPage: true });
  await wp.getByRole('button', { name: `${LONG} 미션 보기` }).click();
  check(`${width}px 미션 개요 가로 넘침 없음`, (await ov()) <= 0);
  await wp.screenshot({ path: `${SHOTS}/w${width}-overview.png`, fullPage: true });
  // U-04 두 미션 왕복: 긴 제목 미션에서 고른 대상·필터가 다른 미션 퀵 리뷰에 남지 않는다
  await wp.getByRole('button', { name: '퀵 리뷰 열기' }).click();
  await wp.getByRole('tab', { name: /미제출/ }).click();
  await wp.getByRole('button', { name: /하늘/ }).first().click();
  await openReview(wp, FOOD);
  check(`${width}px U-04 다른 미션으로 가면 이전 선택·필터가 남지 않는다`,
    (await wp.getByRole('tab', { name: /검토 대기/ }).getAttribute('aria-selected')) === 'true' &&
      (await crumbs(wp)).includes(FOOD) && !(await crumbs(wp)).includes('긴 제목'));

  // 크루원: 목록 필터 유지와 사용자 변경 시 해제
  await pickUser(wp, '민지');
  await go(wp, '미션');
  await wp.getByRole('tab', { name: /완료/ }).click();
  check(`${width}px 빈 목록 안내`, await shown(wp.getByText('검토가 끝난 미션이 없어요')));
  await wp.getByRole('tab', { name: /내 할 일/ }).click();
  await wp.getByRole('button', { name: `${LONG} 미션 보기` }).click();
  check(`${width}px 크루원 상세 가로 넘침 없음`, (await ov()) <= 0);
  await wp.getByRole('button', { name: '제출하기' }).click();
  await wp.getByRole('button', { name: '제출하기' }).click();
  check(`${width}px 상세 오류 표시`, await shown(wp.getByText('제출 내용을 입력해 주세요.')));
  check(`${width}px 상세 버튼·오류 잘림 없음`, (await clipped()) === 0);
  await wp.screenshot({ path: `${SHOTS}/w${width}-member-detail.png`, fullPage: true });
  await wp.getByRole('navigation', { name: '현재 위치' }).getByRole('button', { name: '미션 목록' }).click();
  check(`${width}px 목록 복귀 시 필터 유지`, (await wp.getByRole('tab', { name: /내 할 일/ }).getAttribute('aria-selected')) === 'true');
  await pickUser(wp, '하늘');
  await go(wp, '미션');
  check(`${width}px 사용자 변경 시 필터 해제`, (await wp.getByRole('tab', { name: /전체/ }).getAttribute('aria-selected')) === 'true');
  check(`${width}px 크루원 목록 가로 넘침 없음`, (await ov()) <= 0);
  await wp.screenshot({ path: `${SHOTS}/w${width}-member-list.png`, fullPage: true });
  await ctx.close();
}

// ---------------------------------------------------------------- 저장 버전 불일치
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('crew-prototype/data'));
  raw.schemaVersion = 99;
  localStorage.setItem('crew-prototype/data', JSON.stringify(raw));
  localStorage.setItem('other-app-key', 'keep');
});
await page.reload();
check('저장 버전 불일치 안내', await shown(page.getByText('저장된 예시 데이터가 이 버전과 맞지 않아요.')));
check('불일치 저장값을 자동 삭제하지 않음', await page.evaluate(() => JSON.parse(localStorage.getItem('crew-prototype/data')).schemaVersion === 99));
await page.getByRole('button', { name: '예시 데이터 초기화' }).click();
await page.getByRole('button', { name: '초기화하기' }).click();
await page.getByRole('heading', { level: 1 }).first().waitFor();
check('초기화는 이 앱 키만 복원', (await page.evaluate(() => localStorage.getItem('other-app-key'))) === 'keep' && (await counts(page)) === '1/0/1/3');

check('콘솔 오류 없음', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
