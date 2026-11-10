/**
 * 브라우저 시나리오 점검 (T-01~05, T-10, T-11, 중복·저장 실패·미저장 이동·저장 버전 불일치).
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
const menu = (page, name) => page.getByRole('navigation', { name: '메뉴' }).getByRole('button', { name: new RegExp(`^${name}`) });
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('crew-prototype/data')).data);

async function pickUser(page, name) {
  const roleOf = { 민지: 'member', 준호: 'member', 하늘: 'member', 소라: 'member', 유나: 'member', 지훈: 'leader', 유진: 'leader', 서연: 'admin' };
  const bar = page.getByRole('region', { name: '시연 도구' });
  const roleLabel = { member: '크루원', leader: '크루장', admin: '관리자' }[roleOf[name]];
  const roleSelect = bar.getByLabel('역할');
  if ((await roleSelect.inputValue()) !== roleOf[name]) await roleSelect.selectOption({ label: roleLabel });
  const userSelect = bar.getByLabel('예시 사용자');
  const option = userSelect.locator('option', { hasText: name });
  await userSelect.selectOption(await option.getAttribute('value'));
}

async function resetData(page) {
  await page.getByRole('button', { name: '예시 데이터 초기화' }).click();
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
await page.getByRole('heading', { name: '미션', level: 1 }).waitFor();
check('초기 집계 1/0/1/3', (await counts(page)) === '1/0/1/3', await counts(page));
await page.screenshot({ path: `${SHOTS}/01-leader-missions.png` });

// ---------------------------------------------------------------- T-01
await page.getByRole('button', { name: '미션 등록' }).first().click();
await page.getByRole('button', { name: '등록하기' }).click();
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
check('T-01 비대상자(준호)에게 보이지 않는다', !(await page.getByText('T-01 새 미션').count()));
await pickUser(page, '민지');
check('T-01 대상자(민지)에게 보인다', (await page.getByRole('button', { name: /T-01 새 미션/ }).count()) > 0);
check('T-01 집계 대상 6건, 미제출 4', (await counts(page)) === '1/0/1/4', await counts(page));
await resetData(page);
check('초기화 후 1/0/1/3', (await counts(page)) === '1/0/1/3');

// ---------------------------------------------------------------- T-02
await pickUser(page, '민지');
await page.getByRole('heading', { name: '내 미션', level: 1 }).waitFor();
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
check('취소하면 예시 사용자 유지', (await page.getByRole('region', { name: '시연 도구' }).getByLabel('예시 사용자').inputValue()) === 'user-minji');

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
await menu(page, '퀵 리뷰').click();
await page.getByRole('tab', { name: /검토 대기/ }).waitFor();
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
await menu(page, '알림 미리보기').click();
await page.getByText('실제로 보내지 않아요').first().waitFor();
await page.screenshot({ path: `${SHOTS}/07-notification-preview.png` });
await page.getByRole('button', { name: '내 피드백 보기' }).click();
await page.getByText('알림에서 열었어요.').waitFor();
check('T-04 알림으로 민지 제출물 이동', (await page.getByRole('region', { name: '시연 도구' }).getByLabel('예시 사용자').inputValue()) === 'user-minji');
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
await menu(page, '퀵 리뷰').click();
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

// ---------------------------------------------------------------- T-10
const seededAt = (await stored(page)).seededAt;
const versionsBefore = JSON.stringify((await stored(page)).versions);
await page.reload();
await page.getByRole('heading', { level: 1 }).first().waitFor();
data = await stored(page);
check('T-10 새로고침 후 예시 날짜·버전 유지', data.seededAt === seededAt && JSON.stringify(data.versions) === versionsBefore);
check('T-10 새로고침 후 집계 유지', (await counts(page)) === '1/0/2/2');
check('T-10 새로고침 후 예시 사용자 유지', (await page.getByRole('region', { name: '시연 도구' }).getByLabel('예시 사용자').inputValue()) === 'user-jihun');
await pickUser(page, '유진');
await menu(page, '퀵 리뷰').click();
check('T-10 다른 크루 사용자면 데이터 범위가 바뀐다', (await page.getByRole('heading', { name: '데일리 메이크업 60초 릴스' }).count()) === 1 && !(await page.getByText('민지').count()));

// 관리자 미구현 표시
await pickUser(page, '서연');
// ---------------------------------------------------------------- 2차: 관리자 집계 (T-02~05 재확인)
await page.getByRole('heading', { name: '전체 크루', level: 1 }).waitFor();
const legendNums = async () =>
  page.getByRole('region', { name: '제출 상태 분포' }).locator('li .num').allInnerTexts();
check('관리자 집계 T-05 이후 1/0/2/2', (await legendNums()).join('/') === '1/0/2/2', (await legendNums()).join('/'));
check('관리자 집계 대상 5건', await shown(page.getByText(/대상\s*5\s*건/)));
await page.getByLabel('크루', { exact: true }).selectOption({ label: '푸드 A' });
check('크루 필터 적용 (푸드 A 0/0/2/1)', (await legendNums()).join('/') === '0/0/2/1', (await legendNums()).join('/'));
await page.getByLabel('미션', { exact: true }).selectOption({ label: '동네 맛집 첫 장면 숏폼' });
check('개별 미션이면 단위가 명', await shown(page.getByText(/대상\s*3\s*명/)));
await page.getByLabel('기간 시작').fill('2030-01-01');
check('마감일 기간 밖이면 대상 0', await shown(page.getByText(/대상\s*0\s*명/)));
await page.getByLabel('기간 끝').fill('2029-01-01');
check('시작일이 종료일보다 늦으면 안내', await shown(page.getByText('시작일이 종료일보다 늦어요. 기간을 다시 확인해 주세요.')));
await page.screenshot({ path: `${SHOTS}/10-admin-overview-filter.png` });
await menu(page, '전체 크루').click();
await page.screenshot({ path: `${SHOTS}/11-admin-overview.png` });

// ---------------------------------------------------------------- T-06 / T-12 게시·성과
await pickUser(page, '민지');
await page.getByRole('button', { name: '게시 기록 남기기' }).click();
await page.getByRole('button', { name: '게시 기록 저장' }).click();
check('게시 기록 필수값 검증', await shown(page.getByText('플랫폼을 고르세요.')) && (await shown(page.getByText('게시 URL을 입력해 주세요.'))));
await page.getByLabel('플랫폼').selectOption('유튜브');
await page.getByLabel('게시 URL').fill('https://example.com/share/minji-v2');
await page.getByLabel('게시일').fill('2026-11-02');
await page.getByRole('button', { name: '게시 기록 저장' }).click();
check('검토용 공유 링크는 게시 URL로 받지 않는다', await shown(page.getByText('검토용 공유 링크와 같은 주소예요. 실제 게시물 주소를 넣어 주세요.')));
await page.getByLabel('게시 URL').fill('https://youtube.example/watch?v=minji');
await page.getByLabel('조회수').fill('-3');
await page.getByRole('button', { name: '게시 기록 저장' }).click();
check('음수 조회수 거부', await shown(page.getByText('0 이상의 정수로 입력하거나 비워 두세요.')));
await page.getByLabel('조회수').fill('');
// T-12: 게시 정보만 저장
await page.getByRole('button', { name: '게시 기록 저장' }).click();
await page.getByRole('status').getByText('게시 기록을 저장했어요.').waitFor();
data = await stored(page);
check('T-12 게시 정보만 저장하면 관찰 기록 없음', data.posts.length === 1 && data.observations.length === 0);
check('게시 후에도 완료 상태 유지', data.deliverables.find((d) => d.memberId === 'user-minji').status === 'completed');
check('게시만 하면 미집계', await shown(page.getByText('미집계')));
// T-06: 조회수 0
await page.getByRole('button', { name: '성과 기록 남기기' }).click();
await page.getByLabel('확인일').fill('2026-11-01');
await page.getByLabel('조회수').fill('0');
await page.getByRole('button', { name: '성과 기록 저장' }).click();
check('게시일보다 이른 확인일 거부', await shown(page.getByText('확인일은 게시일(11월 2일)보다 빠를 수 없어요.')));
await page.getByLabel('확인일').fill('2026-11-08');
await page.getByRole('button', { name: '성과 기록 저장' }).click();
await page.getByRole('form', { name: '성과 기록' }).waitFor({ state: 'detached' });
data = await stored(page);
check('T-12 조회수 0이면 관찰 기록 생성', data.observations.length === 1 && data.observations[0].views === 0);
// 같은 확인일 수정, 다른 확인일 추가
await page.getByRole('button', { name: '성과 기록 남기기' }).click();
await page.getByLabel('확인일').fill('2026-11-08');
check('같은 확인일 수정 안내', await shown(page.getByText('11월 8일 기록이 이미 있어요. 저장하면 그 기록을 고쳐요.')));
await page.getByLabel('조회수').fill('0');
await page.getByLabel('회고').fill('첫 장면 반응을 다음 주에 다시 확인할게요.');
await page.getByRole('button', { name: '성과 기록 저장' }).click();
await page.getByRole('form', { name: '성과 기록' }).waitFor({ state: 'detached' });
data = await stored(page);
check('T-12 같은 확인일은 수정', data.observations.length === 1 && data.observations[0].retrospective !== '', JSON.stringify(data.observations));
await page.screenshot({ path: `${SHOTS}/12-member-post.png`, fullPage: true });

await pickUser(page, '서연');
await page.getByRole('button', { name: '구성원 보기' }).first().click();
await page.getByRole('button', { name: /민지/ }).first().click();
await page.getByRole('tab', { name: '콘텐츠 성과' }).click();
check('T-06 관리자 성과에 0회', await shown(page.getByRole('tabpanel').getByText('0', { exact: true })) && (await shown(page.getByRole('tabpanel').getByText('회', { exact: true }))));
check('T-06 확인일·수동 입력 표시', await shown(page.getByRole('tabpanel').getByText('확인일 11월 8일')) && (await shown(page.getByRole('tabpanel').getByText('수동 입력'))));
check('T-06 게시 URL 연결', await shown(page.getByRole('tabpanel').getByRole('link', { name: /youtube.example/ })));
await page.screenshot({ path: `${SHOTS}/13-admin-performance.png` });
await page.getByRole('button', { name: /준호/ }).first().click();
check('준호는 미게시', await shown(page.getByRole('tabpanel').getByText('미게시')));
await page.getByRole('button', { name: /민지/ }).first().click();
await page.getByRole('tab', { name: '활동' }).click();
check('관리자 활동에 1·2차 제출과 피드백', (await page.getByRole('tabpanel').getByRole('heading', { name: '1차 제출' }).count()) === 1 && (await page.getByRole('tabpanel').getByRole('heading', { name: '2차 제출' }).count()) === 1);

// ---------------------------------------------------------------- T-07 제안
await page.getByRole('tab', { name: /광고·커머스 제안/ }).click();
check('제안 없음 빈 상태', await shown(page.getByText('기록된 제안이 없어요')));
await page.getByRole('button', { name: '제안 기록 추가' }).click();
await page.getByRole('button', { name: '제안 기록 저장' }).click();
check('제안 필수값 검증', await shown(page.getByText('브랜드·상품명을 입력해 주세요.')));
await page.getByLabel('광고', { exact: true }).check();
await page.getByLabel('브랜드·상품명').fill('식품 브랜드 A');
await page.getByLabel('제안 내용').fill('신제품 소개 숏폼 1편 제작 가능 여부 확인.');
await page.getByLabel('진행 상태').selectOption({ label: '제안 전달' });
await page.getByLabel(/내부 메모/).fill('단가 협의 전. 11월 둘째 주 촬영 일정 확인 필요.');
await page.getByRole('button', { name: '제안 기록 저장' }).click();
await page.getByRole('status').getByText('제안 기록을 저장했어요.').waitFor();
check('저장 후 내부 메모 표시(관리자)', await shown(page.getByText('내부 메모, 관리자에게만 보여요')));
const statusSelect = page.getByRole('article').getByLabel('진행 상태');
check('같은 상태면 저장 비활성', await page.getByRole('button', { name: '지금과 같은 상태' }).isDisabled());
await statusSelect.selectOption({ label: '협의 중' });
await page.getByRole('button', { name: '상태 저장' }).click();
await page.getByRole('status').getByText('상태를 ‘협의 중’으로 바꿨어요.').waitFor();
data = await stored(page);
check('T-07 제안 이력 2건', data.proposals.length === 1 && data.proposals[0].history.length === 2 && data.proposals[0].status === 'negotiating');
await page.getByText(/변경 이력 2건/).click();
await page.screenshot({ path: `${SHOTS}/14-admin-proposals.png`, fullPage: true });
await pickUser(page, '지훈');
const html = await page.content();
check('T-07 크루장 화면에 내부 메모·제안 없음', !html.includes('단가 협의 전') && !html.includes('식품 브랜드 A'));
for (const screen of ['미션', '퀵 리뷰', '알림 미리보기']) {
  await menu(page, screen).click();
  const h = await page.content();
  if (h.includes('단가 협의 전') || h.includes('내부 메모')) check(`T-07 크루장 ${screen}에 내부 메모 없음`, false);
}
await pickUser(page, '민지');
check('T-07 크루원 화면에 내부 메모·제안 없음', !(await page.content()).includes('단가 협의 전') && !(await page.content()).includes('식품 브랜드 A'));
await pickUser(page, '서연');
await menu(page, '알림 미리보기').click();
check('관리자는 담당 크루 알림 예시를 본다', (await page.getByRole('list', { name: '알림 예시 목록' }).getByRole('listitem').count()) === 3);

// ---------------------------------------------------------------- 3차: F-11B 미제출 안내 미리보기
await page.getByRole('tab', { name: '미제출 안내' }).click();
await page.getByRole('button', { name: /데일리 메이크업/ }).click();
await page.getByRole('button', { name: '미제출 안내 미리보기' }).click();
check('F-11B 관리자: 담당 크루(뷰티 B) 미제출 유나', await shown(page.getByText(/대상\s*1\s*명: 유나/)));
check('F-11B 발송 완료 문구 없음', !(await page.content()).includes('발송 완료') && !(await page.content()).includes('보냈어요'));
await pickUser(page, '지훈');
await menu(page, '알림 미리보기').click();
await page.getByRole('tab', { name: '미제출 안내' }).click();
check('F-11B 크루장은 자기 크루 미션만', (await page.getByRole('list', { name: '미션 목록' }).getByRole('listitem').count()) === 1);
await page.getByRole('button', { name: '미제출 안내 미리보기' }).click();
check('F-11B 푸드 A: 완료 2명 빼고 하늘만', await shown(page.getByText(/대상\s*1\s*명: 하늘/)));
await page.screenshot({ path: `${SHOTS}/16-unsubmitted-preview.png` });

// ---------------------------------------------------------------- 3차: T-09 대상자 전용 미션 + T-08 소통
await menu(page, '미션').click();
await page.getByRole('button', { name: '미션 등록' }).first().click();
await page.getByLabel('제목').fill('민지 전용 촬영 미션');
await page.getByLabel('목표·제출 기준').fill('민지만 대상인 시연용 미션');
await page.getByLabel('텍스트').check();
await page.getByLabel('마감 일시').fill('2030-02-01T18:00');
await page.getByLabel('민지').check();
await page.getByRole('button', { name: '등록하기' }).click();
await page.getByRole('status').getByText('미션을 등록했어요. 대상자 1명에게 보여요.').waitFor();
await menu(page, '알림 미리보기').click();
await page.getByRole('tab', { name: '미제출 안내' }).click();
await page.getByRole('button', { name: /민지 전용 촬영 미션/ }).click();
await page.getByRole('button', { name: '미제출 안내 미리보기' }).click();
check('F-11B 마감 전이면 대상 0명', await shown(page.getByText('지금 안내할 대상이 없어요')) && (await shown(page.getByText(/대상 0명 \(아직 마감 전이에요\)/))));

await menu(page, '크루 소통').click();
check('소통 빈 상태', await shown(page.getByText('아직 올라온 글이 없어요')));
await page.getByRole('button', { name: '글 쓰기' }).first().click();
await page.getByRole('button', { name: '올리기' }).click();
check('글 필수값 검증', await shown(page.getByText('글 구분을 고르세요.')) && (await shown(page.getByText('제목을 입력해 주세요.'))));
await page.getByLabel('공지', { exact: true }).check();
await page.getByLabel('제목').fill('이번 주 촬영 팁 모음');
await page.getByLabel('본문').fill('자연광에서 촬영하면 음식 색이 잘 살아요.');
await page.getByLabel(/관련 미션/).selectOption({ label: '민지 전용 촬영 미션' });
await page.getByRole('button', { name: '올리기' }).click();
await page.getByRole('status').getByText('글을 올렸어요.').waitFor();
check('크루장 화면: 연결 미션 열기 가능', await shown(page.getByRole('button', { name: '미션 열기' })));

await pickUser(page, '하늘');
await menu(page, '크루 소통').click();
check('T-09 비대상(하늘)은 글을 읽는다', await shown(page.getByRole('heading', { name: '이번 주 촬영 팁 모음' })));
check('T-09 비대상은 잠금 표시와 비활성 버튼', await shown(page.getByText('대상자 전용 미션')) && (await page.getByRole('button', { name: '열 수 없음' }).isDisabled()));
check('T-09 비대상에게 미션 제목이 보이지 않음', !(await page.content()).includes('민지 전용 촬영 미션'));
await page.getByRole('button', { name: '질문 쓰기' }).first().click();
check('크루원은 공지를 고를 수 없다', (await page.getByLabel('공지', { exact: true }).count()) === 0);
await page.getByLabel('제목').fill('자막 글꼴 정해진 게 있나요?');
await page.getByLabel('본문').fill('가게 이름 자막에 쓸 글꼴이 궁금해요.');
await page.getByRole('button', { name: '올리기' }).click();
await page.getByRole('status').getByText('글을 올렸어요.').waitFor();
await page.getByRole('button', { name: '댓글 달기' }).click();
check('빈 댓글은 저장되지 않는다', await shown(page.getByText('댓글 내용을 입력해 주세요.')));
await page.screenshot({ path: `${SHOTS}/17-community-member.png` });

await pickUser(page, '준호');
await menu(page, '크루 소통').click();
const titles = await page.getByRole('list', { name: '크루 글 목록' }).getByRole('listitem').allInnerTexts();
check('T-08 공지가 위, 질문이 아래', titles.length === 2 && titles[0].includes('이번 주 촬영 팁') && titles[1].includes('자막 글꼴'), JSON.stringify(titles));
await page.getByRole('button', { name: /자막 글꼴/ }).click();
await page.getByLabel('댓글 쓰기').fill('공지에 있던 기본 글꼴을 써요.');
await page.getByRole('button', { name: '댓글 달기' }).click();
await page.getByRole('status').getByText('댓글을 달았어요.').waitFor();
await pickUser(page, '하늘');
await menu(page, '크루 소통').click();
await page.getByRole('button', { name: /자막 글꼴/ }).click();
check('T-08 같은 크루 다른 사용자가 댓글을 본다', await shown(page.getByText('공지에 있던 기본 글꼴을 써요.')));
check('T-08 목록에 댓글 수', await shown(page.getByRole('button', { name: /자막 글꼴.*댓글 1/ })));

await pickUser(page, '민지');
await menu(page, '크루 소통').click();
await page.getByRole('button', { name: /이번 주 촬영 팁/ }).click();
await page.getByRole('button', { name: '미션 열기' }).click();
check('T-08 대상자는 관련 미션으로 이동', await shown(page.getByRole('heading', { name: '민지 전용 촬영 미션', level: 2 })));

await pickUser(page, '소라');
await menu(page, '크루 소통').click();
check('T-08 다른 크루(소라)에는 글이 섞이지 않는다', await shown(page.getByText('아직 올라온 글이 없어요')) && !(await page.content()).includes('촬영 팁'));
await pickUser(page, '서연');
check('관리자 메뉴에는 크루 소통이 없다', (await menu(page, '크루 소통').count()) === 0);

// ---------------------------------------------------------------- 모바일
const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true });
const mp = await mobile.newPage();
await mp.goto(BASE);
await mp.evaluate(() => localStorage.clear());
await mp.reload();
await pickUser(mp, '민지');
await mp.getByRole('heading', { name: '내 미션', level: 1 }).waitFor();
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('375px 가로 넘침 없음', overflow <= 0, `overflow=${overflow}`);
await mp.getByRole('button', { name: '제출하기' }).click();
const btnBox = await mp.getByRole('button', { name: '제출하기' }).boundingBox();
check('375px 버튼 높이 44px 이상', btnBox && btnBox.height >= 44, btnBox && `h=${btnBox.height}`);
await mp.screenshot({ path: `${SHOTS}/09-mobile-member.png`, fullPage: true });
await pickUser(mp, '서연');
await mp.getByRole('heading', { name: '전체 크루', level: 1 }).waitFor();
const ovAdmin = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('375px 관리자 전체 크루 가로 넘침 없음', ovAdmin <= 0, `overflow=${ovAdmin}`);
await mp.getByRole('button', { name: '구성원 보기' }).first().click();
await mp.getByRole('tab', { name: /광고·커머스 제안/ }).click();
const ovCrew = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('375px 크리에이터 상세 가로 넘침 없음', ovCrew <= 0, `overflow=${ovCrew}`);
await mp.screenshot({ path: `${SHOTS}/15-mobile-admin.png`, fullPage: true });
await pickUser(mp, '하늘');
await menu(mp, '크루 소통').click();
await mp.getByRole('button', { name: '질문 쓰기' }).first().click();
const ovComm = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('375px 크루 소통 가로 넘침 없음', ovComm <= 0, `overflow=${ovComm}`);
const writeBtn = await mp.getByRole('button', { name: '올리기' }).boundingBox();
check('375px 올리기 버튼 44px 이상', writeBtn && writeBtn.height >= 44);
await mp.screenshot({ path: `${SHOTS}/18-mobile-community.png`, fullPage: true });
const mp320 = await (await browser.newContext({ viewport: { width: 320, height: 700 } })).newPage();
await mp320.goto(BASE);
await pickUser(mp320, '지훈');
await menu(mp320, '퀵 리뷰').click();
const ov320 = await mp320.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('320px 가로 넘침 없음', ov320 <= 0, `overflow=${ov320}`);

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
