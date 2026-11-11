import { useRef, type MouseEvent, type ReactNode } from 'react';
import { Button } from '../../components/Button/Button';
import { useStore } from '../../state/AppStore';
import type { Route } from '../../state/routes';
import styles from './Public.module.css';

interface Section {
  id: string;
  label: string;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}

/**
 * P-13 이용 가이드 (v0.6 02 5장, N-06). 정적 문서형 페이지, 상단 목차는 섹션 앵커.
 * 관리자 운영 절차는 관리자로 로그인했을 때만 렌더링한다 (CSS 로 숨기지 않는다).
 * 실제 기능 버튼은 같은 navigate(이동·권한 검사)를 쓴다. 미구현 기능은 버튼 없이 '후속 제공'으로만 안내한다.
 */
export function GuidePage() {
  const { session, navigate, setListFilter } = useStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const crewId = session && session.role !== 'admin' ? session.crewId : null;
  const go = (r: Route) => () => void navigate(r);
  /** 미션 목록을 필터와 함께 연다 (홈 바로가기와 같은 조회 필터) */
  const toMissions = (filter: 'all' | 'todo' | 'done') => () => {
    if (!crewId) return;
    setListFilter(filter);
    void navigate({ screen: 'missions', crewId });
  };
  const isMember = session?.role === 'member';
  const isLeader = session?.role === 'leader';

  const sections: Section[] = [
    {
      id: 'guide-start',
      label: '시작',
      title: '01 시작하기',
      body: (
        <ol className={styles.guideList}>
          <li>홈에서 서비스 소개를 보고 오른쪽 위 ‘로그인’을 눌러요.</li>
          <li>역할(크루원·크루장·관리자)을 고르고, 그 역할의 시연 계정을 골라 ‘시연 로그인’을 눌러요. 실제 비밀번호는 없어요.</li>
          <li>로그인하면 어떤 역할이든 같은 홈으로 돌아와요. 홈 맨 위에 내 이름과 바로가기가 생겨요.</li>
          <li>상단 메뉴의 ‘크루 활동’에서 크루 홈·미션·커뮤니티를, 관리자는 ‘운영 관리’를 골라요.</li>
        </ol>
      ),
      action: !session ? (
        <Button variant="action" onClick={go({ screen: 'login', from: { screen: 'guide' } })}>
          시연 로그인하기
        </Button>
      ) : undefined,
    },
    {
      id: 'guide-crew',
      label: '크루 찾기',
      title: '02 크루 홈과 미션 목록',
      body: (
        <>
          <p>크루는 푸드·뷰티 같은 카테고리별 활동 공간이에요. 이번 시연에서는 계정마다 소속 크루가 미리 정해져 있어요.</p>
          <ul className={styles.guideList}>
            <li>
              <strong>크루 홈</strong>: 어떤 크루인지, 누가 운영하는지, 최근 미션이 무엇인지 보여줘요.
            </li>
            <li>
              <strong>미션 목록</strong>: 크루의 미션을 고르는 페이지예요. 미션을 고르면 독립된 미션 상세 페이지로 이동해요.
            </li>
          </ul>
        </>
      ),
      action: crewId ? <Button onClick={go({ screen: 'crew', crewId })}>내 크루 홈으로</Button> : undefined,
    },
    {
      id: 'guide-mission',
      label: '미션',
      title: '03 미션 제출',
      body: (
        <ul className={styles.guideList}>
          <li>미션 상세에서 목표·제출 기준·기한을 먼저 확인해요.</li>
          <li>제출 형식은 미션마다 글 또는 링크 중 하나예요. 링크는 http:// 또는 https:// 로 시작해야 해요.</li>
          <li>기한이 지나도 제출할 수 있고, ‘기한 후 제출’로 표시만 돼요. 벌점은 없어요.</li>
          <li>제출하면 상태가 ‘검토 대기’가 되고, 크루장이 검토하기 전에는 고칠 수 없어요.</li>
        </ul>
      ),
      action: crewId ? <Button onClick={toMissions('all')}>미션 목록 보기</Button> : undefined,
    },
    {
      id: 'guide-feedback',
      label: '피드백',
      title: '04 피드백과 재제출',
      body: (
        <ul className={styles.guideList}>
          <li>크루장은 제출물을 ‘완료 처리’하거나 ‘보완 요청’을 남겨요. 보완 요청에는 수정 방향이 꼭 들어가요.</li>
          <li>보완 요청을 받으면 미션 상세에서 최신 피드백을 보고, ‘수정한 내용’을 적어 수정본을 다시 제출해요.</li>
          <li>1차·2차 제출과 그때의 피드백은 덮어쓰이지 않고 제출·피드백 이력에 그대로 남아요.</li>
        </ul>
      ),
      action: isMember && crewId ? (
        <Button onClick={toMissions('todo')}>내 할 일 보기</Button>
      ) : isLeader && crewId ? (
        <Button onClick={toMissions('todo')}>검토할 미션 보기</Button>
      ) : undefined,
    },
    {
      id: 'guide-record',
      label: '활동 기록',
      title: '05 게시·성과 기록 (선택)',
      body: (
        <ul className={styles.guideList}>
          <li>검토가 끝난(완료) 결과물은 미션 상세에서 실제 게시 정보와 성과를 선택해서 남길 수 있어요.</li>
          <li>조회수·회고를 적을 때는 확인한 날짜를 함께 적어요. 적지 않은 값은 0이 아니라 ‘미입력’으로 보여요.</li>
          <li>성과 숫자는 직접 입력한 값이에요. 플랫폼에서 자동으로 가져오지 않아요.</li>
        </ul>
      ),
      action: isMember && crewId ? <Button onClick={toMissions('done')}>완료한 미션 보기</Button> : undefined,
    },
    {
      id: 'guide-faq',
      label: 'FAQ',
      title: '06 자주 묻는 질문',
      body: (
        <dl className={styles.faq}>
          <dt>검토 완료면 게시된 건가요?</dt>
          <dd>아니요. 완료는 크루장의 검토가 끝났다는 뜻이에요. 실제 게시 여부는 게시 기록으로 따로 남겨요.</dd>
          <dt>시연 로그인은 실제 계정인가요?</dt>
          <dd>아니요. 미리 만든 가상 계정이에요. 새로고침하면 로그아웃되지만 저장한 기록은 이 브라우저에 그대로 남아요.</dd>
          <dt>성과를 비워 두면 0으로 집계되나요?</dt>
          <dd>아니요. 입력하지 않은 값은 ‘미입력’이고 0과 구분해요.</dd>
          <dt>알림이 카카오톡으로 가나요?</dt>
          <dd>아니요. 이번 시연에서는 알림 예시만 보여주고 실제로 보내지 않아요.</dd>
        </dl>
      ),
    },
    {
      id: 'guide-leader',
      label: '크루장 안내',
      title: '크루장 안내: 미션 등록과 퀵 리뷰',
      body: (
        <ol className={styles.guideList}>
          <li>미션 목록에서 ‘미션 등록’을 눌러 제목·목표와 제출 기준·제출 형식·마감 일시·대상자를 정해요. 등록 뒤에는 고칠 수 없어요.</li>
          <li>등록하면 대상자 전원이 ‘미제출’로 집계되고, 그 미션의 퀵 리뷰로 이동해요.</li>
          <li>퀵 리뷰는 특정 미션 상세에서 ‘퀵 리뷰 열기’로 들어가는 작업 화면이에요. 왼쪽에서 제출자를 고르고 오른쪽에서 원본과 이력을 보고 처리해요.</li>
          <li>자주 쓰는 피드백 문구를 넣은 뒤 그대로 고쳐 쓸 수 있어요.</li>
        </ol>
      ),
      action:
        isLeader && crewId ? (
          <>
            <Button onClick={go({ screen: 'mission-create', crewId })}>미션 등록하기</Button>
            <Button onClick={toMissions('todo')}>검토할 미션 보기</Button>
          </>
        ) : undefined,
    },
  ];
  if (session?.role === 'admin') {
    // 관리자 로그인 후에만 렌더링 (일반 사용자 DOM 에 넣지 않는다)
    sections.push({
      id: 'guide-admin',
      label: '관리자 절차',
      title: '관리자 절차: 운영 관리',
      body: (
        <ol className={styles.guideList}>
          <li>운영 관리에서 담당 크루 전체의 대상·검토 대기·보완 요청·완료·미제출을 같은 기준으로 비교해요.</li>
          <li>크루·기간·미션 필터를 바꾸면 모든 숫자가 같은 필터로 다시 계산돼요. 재제출 버전은 따로 세지 않아요.</li>
          <li>크루를 고르면 구성원, 구성원을 고르면 활동·콘텐츠 성과·제안 이력을 볼 수 있어요.</li>
          <li>광고·커머스 제안 이력은 관리자에게만 보여요. 저장해도 외부로 메시지가 가지 않아요.</li>
        </ol>
      ),
      action: <Button onClick={go({ screen: 'overview' })}>운영 관리 열기</Button>,
    });
  }

  const jump = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    const target = rootRef.current?.querySelector<HTMLElement>(`#${id}`);
    if (!target) return;
    e.preventDefault();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    target.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  };

  return (
    <div className={styles.guide} ref={rootRef}>
      <header className={styles.guideHead}>
        <h1 className={styles.pageTitle}>이용 가이드</h1>
        <p className={styles.lead2}>처음 접속부터 미션 제출·피드백 반영까지 순서대로 읽어 보세요.</p>
      </header>
      <nav className={styles.toc} aria-label="가이드 목차">
        <ol className={styles.tocList}>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={styles.tocLink} onClick={jump(s.id)}>
                {s.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className={styles.guideBody}>
        {sections.map((s) => (
          <section key={s.id} id={s.id} className={styles.guideSection} aria-labelledby={`${s.id}-title`}>
            <h2 className={styles.guideTitle} id={`${s.id}-title`} tabIndex={-1}>
              {s.title}
            </h2>
            <div className={styles.guideText}>{s.body}</div>
            {s.action && <div className={styles.ctas}>{s.action}</div>}
          </section>
        ))}
      </div>
    </div>
  );
}
