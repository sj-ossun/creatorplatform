import { getCrew } from '../../domain/queries';
import { ROLE_LABEL } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import styles from './AppHeader.module.css';

export function AppHeader() {
  const { data, user } = useStore();
  const crewLabel =
    user.role === 'admin'
      ? `담당 크루 ${user.managedCrewIds.length}개`
      : `${getCrew(data, user.crewId)?.name ?? ''} 크루`;
  return (
    <header className={styles.header}>
      <span className={styles.logo}>
        CREW<span className={styles.dot} aria-hidden="true" />
      </span>
      <span className={styles.crew}>{crewLabel}</span>
      <span className={styles.user}>
        {user.name} {ROLE_LABEL[user.role]}
      </span>
    </header>
  );
}
