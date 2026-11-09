# 크리에이터 크루 플랫폼 레퍼런스

작성일·조사 기준일: 2026-11-09  
함께 읽기: [기능 명세서](prototype-spec.md), [디자인 시스템](design-system.md)

## 1. 레퍼런스 사용 원칙

기능·데이터·공개 범위는 prototype-spec.md가 기준이다. 이 문서의 제품·라이브러리 링크는 특정 화면 원리를 참고하기 위한 자료이며 도입·가입·구매·연동 지시가 아니다. 타사의 화면이나 브랜드 자산을 그대로 복제하지 않는다.

1차 제작은 Airtable의 목록·상세 구조, Classroom의 제출·피드백 흐름, Fluent의 토큰·입력 원칙에 집중한다. 2차 관리자 화면과 3차 소통은 같은 디자인 시스템으로 확장한다.

공식 페이지의 설명과 이 프로젝트에 대한 적용 판단을 구분한다. 참고 제품의 편의성·작업 시간 절감이 이 프로토타입에서도 검증되었다고 주장하지 않는다. 외부 페이지는 변경될 수 있으며 관련 코드나 패키지 도입 시 호환 버전을 다시 확인한다.

## 2. 내부 기준 자료

| 자료 | 위치 | 용도와 주의 |
| --- | --- | --- |
| 요청한 제목의 기능 명세서 | [Google Docs 원본](https://docs.google.com/document/d/1if_AiUYaF-8raybEjeSMrG6m9XGAp2zMswIvHKLjDXY/edit?usp=drivesdk) | 본문 v0.3, 2026-11-06 작성. 이번 로컬 고정본의 직접 출처 |
| 로컬 기능 명세서 | [prototype-spec.md](prototype-spec.md) | 본문 전체 보존. 제목·표·공백만 Markdown 정돈 |
| 디자인 시스템 | [design-system.md](design-system.md) | 2026-11-09 v0.4. 첨부 구조·Wanted Sans·CSS 토큰과 업무 검증 규칙 통합. 구체 HEX는 임시값이며 공식 브랜드 가이드·실제 앱 검증을 의미하지 않음 |
| 기존 스토리보드 v0.2 | [로컬 문서](../output/crew_storyboard_v02_20261106.md) | 화면 동선과 목록·상세 구성 참고. 과거 시연 범위와 기능 명세 충돌 시 v0.3 우선 |
| 기존 첫 제작 지시문 | [로컬 문서](../output/crew_prototype_start_prompt_v03_20261106.md) | 기존 작업 맥락. 이 문서 묶음용 최신 시작 지시문은 design-system.md 12절 사용 |
| 원본 MVP 요구사항 | [Google Docs](https://docs.google.com/document/d/1Lvfa_qd3v33jm7yBJqOjJ4o4AIdNFsBshbm4bj5xbic/edit?usp=drivesdk) | 장기 범위의 보존 자료. 이번 문서 작성에서 본문을 재분석하지 않았으며 제작 범위를 확장하는 근거로 사용하지 않음 |

Drive에는 제목에 v0.3이 붙은 별도 문서도 있다. 이번 기준은 사용자가 요청한 제목의 문서이며, 파일 ID는 1if_AiUYaF-8raybEjeSMrG6m9XGAp2zMswIvHKLjDXY이다. 두 문서를 자동으로 병합하거나 서로 같은 파일이라고 간주하지 않는다.

스토리보드의 주차 고정 집계·제안 조회만 가능한 시연 등은 현재 구현 요구사항을 대체하지 않는다. v0.3에는 관리자 필터·제안 등록과 수정·소통 작성 등 실제 로컬 동작 범위가 명시되어 있다.

핵심 제작 기준은 docs 폴더의 7개 파일이다. ../output의 과거 스토리보드·지시문은 선택 참고 자료이며 최신 제작 규칙을 대체하지 않는다. 배포 ZIP에는 링크 확인용으로 함께 포함한다.

## 3. 화면 설계의 핵심 레퍼런스

### R-01 Airtable Record review — 퀵 리뷰 구조

- 공식 자료: [Record review 문서](https://support.airtable.com/articles/4384405105-airtable-interface-layout-record-review)
- 확인한 원리: 여러 기록을 한 인터페이스에서 검토하며 목록·필터·선택 기록 상세를 연결한다.
- 적용 화면: SC-02, 보조적으로 SC-06·07.
- 적용 판단: 제출자 목록을 유지하면서 상세·이력·피드백을 한 작업 영역에서 확인하기에 적합하다.
- 가져올 것: 선택 행 표시, 상태 필터, 목록과 상세의 맥락 유지.
- 가져오지 않을 것: 데이터베이스 빌더·사용자 정의 자동화·내보내기·레퍼런스의 모든 검색/정렬 기능.
- 우리 규칙: 처리 직후 읽기 전용 결과 유지, 다음 대상 명시적 이동, 빈 필터 상세 비우기는 F-04와 T-11을 따른다.
- 참고 위치: 문서의 목록 속성, record review page properties, 목록/상세 이미지.

### R-02 Google Classroom — 제출과 피드백 연결

- 공식 자료: [Give feedback on assignments](https://support.google.com/edu/classroom/answer/9093530?hl=en)
- 확인한 원리: 과제 검토 과정에서 개별 제출물과 피드백을 연결하고 제출 이력을 확인한다.
- 적용 화면: SC-02·03, F-03~06.
- 적용 판단: 크루원이 피드백을 읽고 같은 과제의 수정본을 제출하는 맥락에 적합하다.
- 가져올 것: 과제 기준과 제출물의 연결, 개인별 피드백, 이전 이력 확인.
- 가져오지 않을 것: 점수·성적표·학교 평가·파일 업로드·Google 계정 연동.
- 우리 규칙: 내부 완료 후 재제출 금지, 보완 요청 상태에서만 수정본 제출, 링크/텍스트 한 형식이라는 명세를 우선한다.

### R-03 Fluent 2 — 토큰과 입력 규칙

- 공식 자료: [디자인 토큰](https://fluent2.microsoft.design/design-tokens), [Field](https://fluent2.microsoft.design/components/web/react/core/field/usage), [Fluent 2 홈](https://fluent2.microsoft.design/)
- 확인한 원리: 토큰으로 시각 값을 일관되게 관리하며 입력 필드에 라벨·도움말·검증 상태를 결합한다.
- 적용 화면: 전체 공통 UI, 특히 SC-01·03·04·07의 폼.
- 적용 판단: 역할이 여러 개여도 버튼·입력·오류의 규칙을 일관되게 유지하기에 적합하다.
- 가져올 것: 의미 중심 토큰, 입력 라벨과 도움말·오류 관계.
- 가져오지 않을 것: Microsoft 로고·브랜드, 전체 패키지의 자동 도입.
- 우리 규칙: design-system.md의 색상·글꼴·간격은 자체 제안값이다. Fluent의 공식 디자인이나 인증으로 표현하지 않는다.

### R-04 Circle — 크루별 소통 공간

- 공식 자료: [Spaces overview](https://help.circle.so/p/basics/spaces/spaces-overview)
- 확인한 원리: 커뮤니티를 공간으로 조직하고 내비게이션에서 구분한다.
- 적용 화면: 3차 SC-05, F-10.
- 적용 판단: 크루별 공지·질문·댓글을 미션 업무와 연결하기에 적합하다.
- 가져올 것: 소속 공간의 맥락, 게시글·댓글의 구분.
- 가져오지 않을 것: 채팅·라이브·이벤트·강의 판매·검색·좋아요.
- 우리 규칙: 게시글은 크루 공개, 개인 제출·피드백은 비공개 범위를 유지한다. 관련 미션 비대상자 처리도 F-10을 따른다.

## 4. 도입 후보 비교

아래는 라이브러리·시스템 자체의 설명과 이번 프로젝트의 선택 판단이다. 모두 설치하라는 뜻이 아니다.

| 후보 | 공식 자료 | 이번 적용 판단 |
| --- | --- | --- |
| Fluent 2 | [홈](https://fluent2.microsoft.design/) | 기본 디자인 원칙 참고. 패키지 전체 도입은 필수 아님 |
| shadcn/ui | [Introduction](https://ui.shadcn.com/docs) | 직접 수정 가능한 컴포넌트 코드 접근. 기존 환경에 있다면 활용, 신규 기본은 CSS Modules 유지 |
| Radix Primitives | [Introduction](https://www.radix-ui.com/primitives/docs/overview/introduction) | 스타일 없는 접근성 중심 구성 요소. 복잡한 탭·다이얼로그 등에 선택적으로 검토 |
| Carbon | [공식 사이트](https://www.carbondesignsystem.com/) | 기업용 오픈소스 디자인 시스템. 향후 밀도 높은 관리자 표의 보조 참고, 이번 전체 시각 기준으로 채택하지 않음 |

shadcn/ui는 완성된 서비스 브랜드 규칙 전체를 대신하지 않는다. 라이브러리가 제공하는 접근성 기능도 실제 조합·라벨·색상·화면 흐름까지 자동 검증해 주지는 않는다.

## 5. 스토리보드에 있는 보조 레퍼런스

다음 링크는 기존 로컬 스토리보드에서 확인한 참고 목록이다. 이번 작업에서는 해당 외부 본문을 새로 검토하지 않았다. 핵심 디자인 결정을 이 자료에만 의존하지 않으며, 관련 화면을 구현할 때 다시 읽는다.

| 참고 자료 | 활용 후보 | 제외 범위 |
| --- | --- | --- |
| [Teams Insights 전체 수업 보기](https://support.microsoft.com/en-us/teams/education/quick-start/all-classes-view-in-the-insights-app) | SC-06 전체 크루 → 구성원 조회 | 위험 점수·고도화 통계 |
| [HubSpot 개인 기록](https://knowledge.hubspot.com/records/work-with-records) | SC-07 개인 활동·제안 이력 | 영업 자동화·계약·정산 |

## 6. frontend-design 사용 자료

| 자료 | 링크 | 확인 목적 |
| --- | --- | --- |
| Anthropic 스킬 원문 | [frontend-design SKILL.md](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) | 맥락 기반 디자인 계획·구현·검토 원칙 |
| 공식 플러그인 소개 | [Frontend Design](https://claude.com/plugins/frontend-design) | 플러그인 역할 |
| Claude Code 스킬 문서 | [Skills](https://code.claude.com/docs/en/skills) | SKILL.md 등록·호출 방식 |
| Claude Code 플러그인 설치 | [Install and manage plugins](https://code.claude.com/docs/en/discover-plugins) | 설치와 실제 명령 이름 확인 |

스킬은 디자인 계획과 UI 구현 품질을 돕는 지침이다. 업무 상태·저장·접근 범위의 정확성은 명세서와 테스트로 별도 검증한다. 본 프로젝트의 목표·브랜드 기본값·제약을 먼저 제공하고 결과를 문서 기준으로 검토한다.

실행 순서와 프로젝트용 프롬프트는 [디자인 시스템 12절](design-system.md#12-바이브코딩-도구에-붙여-넣을-지시문)에 있다. 스킬 원문을 이 문서에 복제하거나 설치했다고 표시하지 않는다.

## 7. 참고 자료를 구현에 전달하는 방법

각 화면을 요청할 때 링크 나열만 하지 말고 다음 네 항목을 함께 지정한다.

- 대상 화면과 기능 ID
- 가져올 구성 원리
- 명세서의 고유한 상태·예외 규칙
- 가져오지 않을 기능

예: “SC-02는 R-01의 목록·상세 구조를 참고하되, 리뷰 저장 직후 읽기 전용 결과를 유지하고 다음 대상을 버튼으로 선택한다. 필터 결과가 비면 상세를 비운다. 검색·데이터베이스 설정을 추가하지 않는다.”

외부 자료를 열지 못하면 읽었다고 가정하지 않는다. 기능 명세와 디자인 시스템의 명시된 규칙으로 진행 가능한 범위를 먼저 구현하고, 외부 자료의 세부 시각 확인은 미검증으로 기록한다.


## 8. v0.4 통합 자료

- 사용자 제공 design-system2.md, tokens.css, preview.html의 구조를 채택했다. 원본은 편집하지 않았다.
- [CSS 토큰](tokens.css)이 코드 값의 기준이며 [미리보기](preview.html)와 [스타일](preview.css)은 이를 참조한다. 미리보기에 토큰을 복제하지 않는다.
- [Wanted Sans 공식 저장소](https://github.com/wanteddev/wanted-sans): 글꼴 배포·라이선스 참고. 앱에서는 npm 패키지와 잠금 파일을 사용한다. 미리보기는 첨부 원본의 CDN 1.0.3을 사용하며 네트워크 차단 시 시스템 글꼴로 대체된다.
- [MDN aria-disabled](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled): ARIA 속성만으로 이벤트가 차단되지 않는 점을 반영했다.
- [W3C 비텍스트 대비](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): 경계와 실제 인접 배경을 함께 확인한다.
- 원본과 이전 문서 사본은 tmp/crew_design/sources_20261109에 보존했다. 현재 제작 기준은 docs/design-system.md 하나다.
- 정적 미리보기의 화면 확인은 앱의 저장·접근·업무 시나리오 테스트 통과를 의미하지 않는다.
