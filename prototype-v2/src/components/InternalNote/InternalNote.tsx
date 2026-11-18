import type { ReactNode } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './InternalNote.module.css';

/**
 * 관리자 전용 메모 (디자인 6.14).
 * 크루장·크루원 화면에서는 이 컴포넌트를 렌더링하지 않는다. 가리거나 흐리게 처리하지 않는다.
 */
export function InternalNote({ children }: { children: ReactNode }) {
  return (
    <section className={styles.internal} aria-label="내부 메모">
      <p className={styles.head}>
        <Icon name="lock" />
        내부 메모, 관리자에게만 보여요
      </p>
      <p className={styles.body}>{children}</p>
    </section>
  );
}
