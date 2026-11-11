import { useEffect, useState } from 'react';
import { Button } from './components/Button/Button';
import { ConfirmDialog } from './components/ConfirmDialog/ConfirmDialog';
import { ErrorBand } from './components/Field/Field';
import { SaveNotice } from './components/SaveNotice/SaveNotice';
import { TopNav } from './components/TopNav/TopNav';
import { createSeed } from './data/seed';
import { Denied, LoginRequired } from './features/common/Page';
import { LoginPage } from './features/public/LoginPage';
import { GuidePage } from './features/public/GuidePage';
import { SiteFooter } from './components/SiteFooter/SiteFooter';
import { isPublic } from './state/routes';
import { HomePage } from './features/home/HomePage';
import { CrewHomePage } from './features/crew/CrewHomePage';
import { ReviewPage } from './features/review/ReviewPage';
import { CrewNav } from './components/CrewNav/CrewNav';
import { MissionListPage } from './features/missions/MissionListPage';
import { LeaderMissionPage } from './features/missions/LeaderMissionPage';
import { MissionCreatePage } from './features/missions/MissionCreatePage';
import { CommunityScreen } from './features/community/CommunityScreen';
import { MemberMissionPage } from './features/my-missions/MemberMissionPage';
import { NotificationsScreen } from './features/notifications/NotificationsScreen';
import { OverviewScreen } from './features/overview/OverviewScreen';
import type { AppData } from './domain/types';
import { StoreProvider, useStore } from './state/AppStore';
import type { Storage } from './storage/storage';
import styles from './App.module.css';

type Boot =
  | { kind: 'ready'; data: AppData; warning: string | null }
  | { kind: 'incompatible' }
  | { kind: 'unreadable' };

function boot(storage: Storage, volatileWarning: string | null): Boot {
  const loaded = storage.load();
  if (loaded.kind === 'ok') return { kind: 'ready', data: loaded.data, warning: volatileWarning };
  if (loaded.kind === 'incompatible') return { kind: 'incompatible' };
  if (loaded.kind === 'unreadable') return { kind: 'unreadable' };
  // 최초 실행: 이때만 예시 날짜를 만든다
  const seed = createSeed(new Date().toISOString());
  try {
    storage.save(seed);
    return { kind: 'ready', data: seed, warning: volatileWarning };
  } catch {
    return {
      kind: 'ready',
      data: seed,
      warning: '브라우저에 저장하지 못했어요. 새로고침하면 기록이 사라질 수 있어요. 시크릿 모드나 저장 공간을 확인해 주세요.',
    };
  }
}

export function App({ storage, volatileWarning = null }: { storage: Storage; volatileWarning?: string | null }) {
  const [state, setState] = useState<Boot>(() => boot(storage, volatileWarning));
  if (state.kind !== 'ready') {
    return <LoadIssue storage={storage} kind={state.kind} onReset={(data) => setState({ kind: 'ready', data, warning: null })} />;
  }
  return (
    <StoreProvider storage={storage} initialData={state.data} initialStorageWarning={state.warning}>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { session, user, route, routeAllowed, dialog, toast, storageWarning } = useStore();
  // 다른 페이지로 바뀌면 맨 위에서 시작한다 (같은 페이지 안의 선택 변경은 그대로)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.screen]);
  let screen;
  // 보호 페이지는 로그인했을 때만 그린다. 비로그인이면 내용 없이 로그인 안내만 (N-03)
  if (!session && !isPublic(route)) screen = <LoginRequired />;
  else if (!routeAllowed) screen = <Denied />;
  else {
    switch (route.screen) {
      case 'home':
        screen = <HomePage />;
        break;
      case 'login':
        screen = <LoginPage key={route.reason ?? 'login'} route={route} />;
        break;
      case 'guide':
        screen = <GuidePage />;
        break;
      case 'crew':
        screen = <CrewHomePage crewId={route.crewId} />;
        break;
      case 'missions':
        screen = <MissionListPage crewId={route.crewId} />;
        break;
      case 'mission':
        // 같은 미션 ID 를 역할에 맞게: 크루원은 단일 본문, 크루장은 기준·현황 + 퀵 리뷰 열기
        screen =
          user.role === 'leader' ? (
            <LeaderMissionPage key={route.missionId} missionId={route.missionId} />
          ) : (
            <MemberMissionPage missionId={route.missionId} feedbackId={route.feedbackId} />
          );
        break;
      case 'mission-create':
        screen = <MissionCreatePage crewId={route.crewId} />;
        break;
      case 'review':
        screen = <ReviewPage route={route} />;
        break;
      case 'notifications':
        screen = <NotificationsScreen />;
        break;
      case 'overview':
        screen = <OverviewScreen />;
        break;
      case 'community':
        screen = <CommunityScreen key={route.crewId} crewId={route.crewId} />;
        break;
    }
  }
  return (
    <div className={styles.app}>
      <TopNav />
      <CrewNav />
      {/* 04 4장: 퀵 리뷰·운영은 비교 작업에 맞게 넓게 (1440px), 나머지는 1200px */}
      <main className={styles.main} id="main" data-wide={route.screen === 'review' || route.screen === 'overview' || undefined}>
        {storageWarning && <ErrorBand>{storageWarning}</ErrorBand>}
        {screen}
      </main>
      <SiteFooter />
      <SaveNotice key={toast?.id} message={toast?.message ?? null} />
      {dialog && (
        <ConfirmDialog
          title={dialog.title}
          body={dialog.body}
          stayLabel={dialog.stayLabel}
          goLabel={dialog.goLabel}
          onResolve={dialog.resolve}
        />
      )}
    </div>
  );
}

/** 저장 형식 버전 불일치·읽을 수 없는 저장값. 자동 삭제하지 않고 초기화를 안내한다. */
function LoadIssue({
  storage,
  kind,
  onReset,
}: {
  storage: Storage;
  kind: 'incompatible' | 'unreadable';
  onReset: (data: AppData) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.issue}>
      <ErrorBand>
        {kind === 'incompatible'
          ? '저장된 예시 데이터가 이 버전과 맞지 않아요. 예시 데이터를 초기화하면 다시 쓸 수 있어요.'
          : '저장된 예시 데이터를 읽을 수 없어요. 예시 데이터를 초기화하면 다시 쓸 수 있어요.'}
      </ErrorBand>
      {failed && <ErrorBand>예시 데이터를 초기화하지 못했어요. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.</ErrorBand>}
      <div>
        <Button variant="strong" onClick={() => setAsking(true)}>
          예시 데이터 초기화
        </Button>
      </div>
      {asking && (
        <ConfirmDialog
          title="예시 데이터를 처음 상태로 되돌릴까요?"
          body="이 앱의 저장값만 처음 예시로 바뀌어요. 다른 사이트의 저장값은 그대로예요."
          stayLabel="계속 사용"
          goLabel="초기화하기"
          onResolve={(go) => {
            setAsking(false);
            if (!go) return;
            const seed = createSeed(new Date().toISOString());
            try {
              storage.save(seed);
              onReset(seed);
            } catch {
              setFailed(true);
            }
          }}
        />
      )}
    </div>
  );
}
