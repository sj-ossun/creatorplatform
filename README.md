# 크리에이터 크루 플랫폼 — 1차 프로토타입

진행자 동반 사용자 테스트용 프로토타입입니다. 기준 문서는 `docs/`에 있습니다.

- 기능 기준: [docs/prototype-spec.md](docs/prototype-spec.md) (기능 명세서 v0.3)
- 화면 기준: [docs/design-system.md](docs/design-system.md) (디자인 시스템 v0.4), [src/styles/tokens.css](src/styles/tokens.css)
- 정적 견본: [docs/preview.html](docs/preview.html) + [docs/preview.css](docs/preview.css) (`docs/tokens.css`와 같은 폴더에서 열기)
- 참고: [docs/references.md](docs/references.md), [docs/README.md](docs/README.md)

> 서버·로그인·실제 발송이 없습니다. 모든 데이터는 같은 브라우저의 localStorage에만 저장되고, 등장인물은 가상 인물입니다.

## 실행

```bash
npm install
npm run dev        # 개발 실행 http://localhost:5173 (포트 고정: localStorage는 출처별로 따로 저장됨)
npm run typecheck  # TypeScript 타입 검사
npm test           # Vitest 핵심 규칙 테스트
npm run build      # 타입 검사 + 배포 파일 빌드 (dist/)
```

브라우저 시나리오 점검(선택, Playwright가 설치된 환경):

```bash
npm run build && npx vite preview --port 4173 --strictPort
NODE_PATH=$(npm root -g) npm run e2e   # 다른 터미널에서
```

## 이번 묶음 범위 (1차)

명세 8장의 1차 묶음: **F-01~06 + 공통 상태 집계 함수(F-08 계산) + F-11A**.

| 기능 | 화면 | 상태 |
| --- | --- | --- |
| F-01 역할 전환·저장·초기화 | 상단 시연 도구(SimBar) | 구현 |
| F-02 미션 등록·대상 지정 | 크루장 › 미션 (SC-01) | 구현 |
| F-03 최초 제출 / F-06 수정·재제출 | 크루원 › 내 미션 (SC-03) | 구현 |
| F-04 퀵 리뷰 / F-05 피드백·처리 결과 | 크루장 › 퀵 리뷰 (SC-02) | 구현 |
| F-08 공통 집계 계산 | `src/domain/aggregate.ts` (미션 상세 분포·필터 개수에 사용) | 구현 |
| F-11A 피드백 알림 예시·이동 | 크루장·관리자 › 알림 미리보기 (SC-08) | 구현 |
| F-07 게시·성과, F-08 관리자 화면, F-09 제안 | 2차 묶음 | 미구현 (관리자 ‘전체 크루’는 미구현 안내만 표시) |
| F-10 크루 소통, F-11B 미제출 안내 | 3차 묶음 | 미구현 (메뉴에 넣지 않음) |

## 시연 순서 예 (T-02~05)

1. 예시 사용자 **민지** → 내 미션 → `제출하기` (검토 대기 2·보완 0·완료 1·미제출 2)
2. **지훈** → 퀵 리뷰 → 민지 → `보완 요청` + 수정 방향 → `보완 요청 남기기`
3. 알림 미리보기 → `내 피드백 보기` (예시 사용자가 민지로 바뀜) → `수정본 제출하기`
4. **지훈** → 퀵 리뷰 → `완료 처리` → `남은 검토 대기 없음`
5. `예시 데이터 초기화`로 처음 상태(1/0/1/3)로 되돌림

## 구조

```
src/
  domain/      타입, 상태 코드, 업무 명령(계산만), 집계, 접근 범위, 한국 시간 처리
  storage/     localStorage 어댑터 (schemaVersion, 이 앱 키만 사용)
  state/       Context 공유 상태, 저장 성공 후 확정(commit.ts), 화면 이동·접근 확인(routes.ts)
  data/        예시 데이터 (최초 실행·초기화에서만 생성)
  components/  디자인 시스템 6장 컴포넌트 (CSS Modules, 토큰만 사용)
  features/    화면(SC-01·02·03·08)과 2차 안내
e2e/           브라우저 시나리오 점검 스크립트
```

## 구현 메모·가정

- 저장 흐름: 명령이 다음 데이터 전체를 계산 → localStorage에 저장 → 성공하면 화면·알림 확정. 실패하면 이전 상태와 입력을 유지하고 오류 띠를 띄웁니다. 저장 중 상태가 보이도록 300ms 대기를 둡니다(`SAVE_DELAY_MS`).
- 중복 방지: 버튼 disabled + 처리 중 가드 + 도메인 조건(최신 검토 대기 버전만 처리, 검토 대기·완료 상태에서 제출 불가, 피드백 이벤트당 알림 1개).
- 마감 일시는 `datetime-local` 값을 Asia/Seoul로 해석하며, 지금보다 이전 일시로는 새 미션을 등록할 수 없게 했습니다(제작 가정).
- 역할 선택을 바꾸면 그 역할의 첫 예시 사용자로 바뀝니다. 역할과 사용자가 어긋난 상태는 만들지 않습니다.
- 메뉴 숨김 외에 화면 이동·렌더링마다 예시 접근 범위를 확인합니다. 실제 서버 보안이 아닙니다.
- 화면 세부(헤더·메뉴·목록 행·버전 상자·피드백 입력·알림 문구)는 `docs/preview.html` 견본에 맞췄습니다. 견본의 고정 숫자는 쓰지 않고 모두 원본 데이터에서 계산합니다.
- 회사 공식 주황 HEX는 미확정이며 `#FF7A00`을 제작값으로 씁니다.
