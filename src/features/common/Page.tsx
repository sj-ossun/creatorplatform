import type { ReactNode } from 'react';
import { useStore } from '../../state/AppStore';
import { startRoute } from '../../state/routes';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { Tag } from '../../components/Tag/Tag';
import { formatDetail } from '../../domain/time';
import type { Mission } from '../../domain/types';
import styles from './Page.module.css';

export function PageHeader({ title, crumb, children }: { title: ReactNode; crumb?: string; children?: ReactNode }) {
  return (
    <div className={styles.header}>
      <div>
        {crumb && <p className={styles.crumb}>{crumb}</p>}
        <h1 className={styles.title}>{title}</h1>
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

export function Denied() {
  const { user, navigate } = useStore();
  return (
    <div className={styles.panel}>
      <EmptyState
        title="이 화면을 열 수 없어요"
        action={<Button onClick={() => void navigate(startRoute(user))}>처음 화면으로</Button>}
      >
        지금 예시 사용자에게 허용된 범위가 아니에요. 다른 예시 사용자를 고르거나 처음 화면으로 돌아가세요.
      </EmptyState>
    </div>
  );
}

export const pageStyles = styles;
