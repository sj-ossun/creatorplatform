/**
 * v2 브라우저 점검 (디자인 시스템 v0.7 + 확정 견본 v3).
 * 실행: npm run build:v2 && npx vite preview --config prototype-v2/vite.config.ts --port 4174 --strictPort 를 띄운 뒤 `npm run e2e:v2`
 * 확인: 공개 홈 순서·예시 표시, 역할별 상단 메뉴, 로그인 홈 뼈대, 크루 메뉴 카드, 제출 → 보완 요청 → 같은 링크로 다시 제출('지난 링크와 같음'),
 *       광고 제안 이름, 화면마다 주황 버튼 하나 이하, 390px 가로 넘침 없음, 페이지 오류 없음.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:4174/';
const SHOTS = process.env.SHOTS_DIR ?? 'prototype-v2/e2e/screenshots';
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const ORANGE = 'rgb(255, 110, 0)';
/** 화면에 보이는 주황(주 행동) 버튼 수 */
const orangeButtons = (page) =>
  page.evaluate((orange) => [...document.querySelectorAll('button, a')].filter((b) => b.offsetParent && getComputedStyle(b).backgroundColor === orange).length, ORANGE);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const topMenu = (page) => page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button').allInnerTexts();
const crewNav = (page) => page.getByRole('navigation', { name: '크루 메뉴' });

async function login(page, role, id) {
  await page.getByRole('banner').getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByRole('radio', { name: new RegExp('^' + role) }).check();
  await page.getByLabel('시연 계정').selectOption(id);
  await page.getByRole('button', { name: '시연 로그인' }).click();
  await page.getByRole('heading', { level: 1 }).first().waitFor();
}
async function logout(page) {
  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.getByRole('banner').getByRole('button', { name: '로그인', exact: true }).waitFor();
}

const browser = await chromium.launch();
const errors = [];
for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.on('pageerror', (e) => errors.push(`${width}: ${e}`));
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const w = `[${width}]`;

  // 공개 홈
  const order = await page.locator('main h2').allInnerTexts();
  const want = ['먼저 해본 크루원들 이야기', '미션 하나가 기록으로 남기까지', '이번 주에 만들어볼 미션', '크루가 만든 콘텐츠'];
  check(`${w} 공개 홈 순서: 후기 → 이용 방법 → 이번 주 미션 → 우수 사례`, want.every((t, i) => order.indexOf(t) === order.indexOf(want[0]) + i), order.join(' / '));
  check(`${w} 공개 홈 '예시' 표시 (수치·후기)`, (await page.getByText('예시 수치', { exact: true }).count()) > 0 && (await page.getByText('크루원 후기 (예시)').count()) === 1);
  check(`${w} 후기 별점 5·4·5`, (await page.getByRole('img', { name: /만족도 5점 만점에/ }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').match(/(\d)점$/)[1]).join(''))) === '545');
  check(`${w} 공개 홈 주황 버튼 1개`, (await orangeButtons(page)) === 1);
  check(`${w} 공개 홈 가로 넘침 없음`, (await overflow(page)) <= 0);
  if (width === 1280) check(`${w} 공개 메뉴: 이번 주 미션·이용 방법·우수 사례`, (await topMenu(page)).join('|') === '이번 주 미션|이용 방법|우수 사례');
  await page.screenshot({ path: `${SHOTS}/landing-${width}.png`, fullPage: true });

  // 크루원 홈
  await login(page, '크루원', 'user-minji');
  check(`${w} 크루원 상단 메뉴`, (await topMenu(page)).map((t) => t.trim()).join('|') === '크루 활동|광고 제안|내 성과|우수 사례|이용 가이드');
  check(`${w} 크루원 홈 인사`, (await page.getByRole('heading', { name: '민지님, 이번 주 콘텐츠를 만들어볼까요?' }).count()) === 1);
  check(`${w} 가장 먼저 할 일 + 주황 버튼 1개`, (await page.getByRole('heading', { name: '가장 먼저 할 일' }).count()) === 1 && (await orangeButtons(page)) === 1);
  check(`${w} 새 소식·크루방 바로가기`, (await page.getByRole('heading', { name: '새 소식' }).count()) === 1 && (await page.getByRole('button', { name: '크루방으로' }).count()) === 1);
  check(`${w} 크루원 홈 가로 넘침 없음`, (await overflow(page)) <= 0);
  check(`${w} 홈 우수 사례 작은 카드(새 소식 아래)`, (await page.getByRole('heading', { name: '우수 사례', exact: true }).count()) === 1 && (await page.getByRole('list', { name: '우수 사례' }).getByRole('button').count()) >= 1);
  await page.getByRole('list', { name: '우수 사례' }).getByRole('button').first().click();
  check(`${w} 우수 사례 카드 → 우수 사례 페이지의 그 사례`, (await page.getByRole('heading', { level: 1, name: '우수 사례' }).count()) === 1 && (await page.locator('article[data-focus]').count()) === 1);
  await page.getByRole('banner').getByRole('button', { name: 'CREW 홈' }).click();
  await page.screenshot({ path: `${SHOTS}/member-home-${width}.png`, fullPage: true });

  // 크루방 + 크루 메뉴 카드 + 커뮤니티 게시판
  await page.getByRole('button', { name: '크루방으로' }).click();
  await page.getByRole('heading', { name: '푸드 A 크루방' }).waitFor();
  check(`${w} 크루 메뉴 카드: 크루방·미션·커뮤니티`, (await crewNav(page).getByRole('button').allInnerTexts()).map((t) => t.trim()).slice(0, 3).join('|') === '크루방|미션|커뮤니티');
  check(`${w} 크루방 주황 버튼 1개 이하`, (await orangeButtons(page)) <= 1);
  check(`${w} 크루방 가로 넘침 없음`, (await overflow(page)) <= 0);
  await page.screenshot({ path: `${SHOTS}/member-room-${width}.png`, fullPage: true });
  await crewNav(page).getByRole('button', { name: '커뮤니티' }).click();
  const boardNav = width >= 768 ? crewNav(page).getByRole('list', { name: '커뮤니티 게시판' }) : page.getByRole('navigation', { name: '커뮤니티 게시판 고르기' });
  check(`${w} 커뮤니티 게시판 4개 (공지·자유·Q&A·전체 크루)`, (await boardNav.getByRole('button').count()) === 4);

  // 광고 제안
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '광고 제안' }).click();
  check(`${w} 광고 제안 화면 제목`, (await page.getByRole('heading', { level: 1, name: '광고 제안' }).count()) === 1);
  check(`${w} 광고 제안 주황 버튼 1개 이하`, (await orangeButtons(page)) <= 1);
  await logout(page);

  if (width === 1280) {
    // 제출 → 보완 요청 → 같은 링크로 다시 제출: '지난 링크와 같음'
    await login(page, '크루원', 'user-haneul');
    await page.getByRole('button', { name: '미션 열기' }).click();
    await page.getByLabel('영상 링크').fill('https://youtube.com/shorts/jNQXAC9IVRw');
    await page.getByRole('button', { name: '제출하기' }).click();
    await page.getByText('검토를 기다리고 있어요').first().waitFor();
    check(`${w} 크루원 제출 → 검토 대기`, true);
    // 예시 미션은 이미 마감이 지나서 고칠 수 없다 (사용자 결정 (나))
    check(`${w} 마감 지난 검토 대기: 고치기 버튼 없음 + 안내`, (await page.getByRole('button', { name: '제출 내용 고치기' }).count()) === 0 && (await page.getByText('마감이 지나 제출 내용을 고칠 수 없어요').count()) === 1);
    // 시연용: 이 미션 마감을 3일 뒤로 옮겨 검토 전 수정을 확인한다
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('crew-prototype-v2/data'));
      const box = raw.data ?? raw;
      const m = box.missions.find((x) => x.id === 'mission-food-1');
      m.dueAt = new Date(Date.now() + 3 * 86400000).toISOString();
      localStorage.setItem('crew-prototype-v2/data', JSON.stringify(raw));
    });
    await page.reload();
    if (await page.getByRole('banner').getByRole('button', { name: '로그인', exact: true }).count()) await login(page, '크루원', 'user-haneul');
    await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '크루 활동' }).click();
    await page.getByRole('button', { name: '미션', exact: true }).first().click();
    await page.getByRole('button', { name: /동네 맛집 첫 장면 숏폼/ }).first().click();
    await page.getByRole('button', { name: '제출 내용 고치기' }).click();
    check(`${w} 고치기: 지금 링크가 미리 채워짐`, (await page.getByLabel('영상 링크').inputValue()) === 'https://youtube.com/shorts/jNQXAC9IVRw');
    await page.getByLabel('영상 링크').fill('https://youtube.com/shorts/fRQSKnSIRcY');
    await page.getByRole('button', { name: '고친 내용 저장' }).click();
    await page.getByText('검토를 기다리고 있어요').first().waitFor();
    check(`${w} 고친 뒤 '수정함' 표시 · 차수 그대로`, (await page.getByText(/수정함$/).count()) >= 1 && (await page.getByText('2차 제출').count()) === 0);
    check(`${w} 제출 기록에 커버`, (await page.locator('[data-kind]').count()) >= 1);
    await crewNav(page).getByRole('button', { name: '크루방' }).click();
    check(`${w} 크루원 크루방 '내 제출물' 유튜브 커버 링크`, (await page.getByRole('heading', { name: '내 제출물' }).count()) === 1 && (await page.getByRole('link', { name: /영상 유튜브에서 열기 \(새 창\)$/ }).count()) === 1);
    check(`${w} 커버 링크는 원래 주소를 새 창으로`, (await page.getByRole('link', { name: /영상 유튜브에서 열기/ }).first().getAttribute('target')) === '_blank');
    await logout(page);

    await login(page, '크루장', 'user-jihun');
    check(`${w} 크루장 상단 메뉴`, (await topMenu(page)).map((t) => t.trim()).join('|') === '크루 활동|광고 제안|우수 사례|이용 가이드');
    check(`${w} 크루장 홈: 검토를 기다리는 미션`, (await page.getByRole('heading', { name: '검토를 기다리는 미션' }).count()) === 1);
    await page.getByRole('button', { name: '크루방으로' }).click();
    check(`${w} 크루장 크루방 '최근 제출물' + 새 제출`, (await page.getByRole('heading', { name: '최근 제출물' }).count()) === 1 && (await page.getByText('새 제출', { exact: true }).count()) >= 1);
    await page.getByRole('button', { name: '하늘 · 동네 맛집 첫 장면 숏폼' }).click();
    check(`${w} 최근 제출물 제목 → 그 사람 퀵 리뷰`, (await page.getByRole('heading', { name: '하늘' }).count()) >= 1);
    check(`${w} 퀵 리뷰 큰 커버`, (await page.getByRole('link', { name: '하늘 1차 제출 영상 유튜브에서 열기 (새 창)' }).count()) === 1);
    check(`${w} 퀵 리뷰: 제출 후 수정함 + 고치기 전 내용`, (await page.getByText(/^제출 후 수정함/).count()) === 1 && (await page.getByText(/고치기 전 내용 보기 \(1번 고침\)/).count()) === 1);
    await page.getByRole('banner').getByRole('button', { name: 'CREW 홈' }).click();
    await page.getByRole('button', { name: /검토하기$/ }).first().click();
    await page.locator('label[data-result="revision_requested"]').first().click();
    await page.getByRole('textbox').last().fill('첫 장면에 메뉴를 먼저 보여 주세요.');
    await page.getByRole('region', { name: /제출/ }).last().waitFor().catch(() => {});
    const save = page.locator('button').filter({ hasText: /저장|보내기|요청/ }).last();
    await save.click();
    await page.getByRole('region', { name: '처리 결과' }).waitFor();
    check(`${w} 크루장 보완 요청 저장`, true);
    await logout(page);

    await login(page, '크루원', 'user-haneul');
    await page.getByRole('button', { name: '수정본 제출하기' }).click();
    await page.getByLabel('수정한 내용').fill('첫 3초에 메뉴를 먼저 넣었어요.');
    check(`${w} 다시 제출: 지난 링크(고친 링크)가 미리 채워짐`, (await page.getByLabel('영상 링크').inputValue()) === 'https://youtube.com/shorts/fRQSKnSIRcY');
    await page.getByRole('button', { name: '수정본 제출하기' }).click();
    await page.getByText('검토를 기다리고 있어요').first().waitFor();
    check(`${w} '지난 링크와 같음' 표시`, (await page.getByText('지난 링크와 같음').count()) >= 1);
    await logout(page);

    // 관리자
    await login(page, '관리자', 'user-seoyeon');
    check(`${w} 관리자 상단 메뉴`, (await topMenu(page)).map((t) => t.trim()).join('|') === '운영 관리|커뮤니티|우수 사례|이용 가이드');
    check(`${w} 관리자 홈 주황 버튼 = 운영 관리로`, (await orangeButtons(page)) === 1 && (await page.getByRole('button', { name: '운영 관리로' }).count()) === 1);
    await page.screenshot({ path: `${SHOTS}/admin-home-${width}.png`, fullPage: true });
    await logout(page);
  }
  await page.close();
}
await browser.close();
check('페이지 오류 없음', errors.length === 0, errors.join(' | '));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} 통과`);
process.exit(failed ? 1 : 0);
