import type { ReactNode } from 'react';
import { useStore } from '../../state/AppStore';
import { HOME } from '../../state/routes';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { Tag } from '../../components/Tag/Tag';
import { formatDetail } from '../../domain/time';
import type { Mission } from '../../domain/types';
import { HelpTitle } from '../../components/HelpTitle/HelpTitle';
import styles from './Page.module.css';

/** 페이지 머리. help 는 제목 오른쪽 (?) 도움말로 접어 두는 설명, children 은 늘 보이는 정보(마감·건수 등) */
export function PageHeader({ title, crumb, help, children }: { title: ReactNode; crumb?: string; help?: ReactNode; children?: ReactNode }) {
  return (
    <div className={styles.header}>
      <div>
        {crumb && <p className={styles.crumb}>{crumb}</p>}
        <HelpTitle className={styles.title} title={title} help={help} />
      </div>
      {children && <div className={styles.sub}>{children}</div>}
    </div>
  );
}

/** 마감 일시 + 필요하면 시연용 기한 태그 (디자인 5.3) */
export function DueLine({ mission, prefix = '마감' }: { mission: Mission; prefix?: string }) {
  return (
    <span className={styles.due}>
      <span>
        {prefix && `${prefix} `}
        <time dateTime={mission.dueAt}>{formatDetail(mission.dueAt)}</time>
      </span>
      {mission.demoDue && <Tag variant="sim">시연용 기한</Tag>}
    </span>
  );
}

/** 비로그인으로 보호 페이지에 머물렀을 때. 내용·대상 이름 없이 로그인만 안내한다 (N-03) */
export function LoginRequired() {
  const { navigate } = useStore();
  return (
    <div className={styles.panel}>
      <EmptyState
        title="로그인이 필요한 화면이에요"
        action={
          <div className={styles.actions}>
            <Button variant="action" onClick={() => void navigate({ screen: 'login', reason: 'protected' })}>
              로그인하기
            </Button>
            <Button variant="quiet" onClick={() => void navigate(HOME)}>
              홈으로
            </Button>
          </div>
        }
      >
        시연 계정으로 로그인하면 홈에서 이용할 기능을 고를 수 있어요.
      </EmptyState>
    </div>
  );
}

/** 열 수 없는 화면·미션 (v0.6 N-03: 내용 노출 없이 목록·홈 복귀) */
export function Denied() {
  const { user, navigate } = useStore();
  const crewId = user.role !== 'admin' ? user.crewId : null;
  return (
    <div className={styles.panel}>
      <EmptyState
        title="이 화면을 열 수 없어요"
        action={
          <div className={styles.actions}>
            {crewId && <Button onClick={() => void navigate({ screen: 'missions', crewId })}>미션 목록으로</Button>}
            <Button variant="quiet" onClick={() => void navigate(HOME)}>
              홈으로
            </Button>
          </div>
        }
      >
        지금 계정에 허용된 범위가 아니거나 없는 화면이에요. 볼 수 있는 목록이나 홈에서 다시 골라 주세요.
      </EmptyState>
    </div>
  );
}

export const pageStyles = styles;
