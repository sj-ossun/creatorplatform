import { useId } from 'react';
import { getCrew } from '../../domain/queries';
import { useStore } from '../../state/AppStore';
import styles from './CrewPicker.module.css';

/** 관리자 커뮤니티 왼쪽 메뉴 맨 위 '크루' 고르기 (담당 크루만) */
export function CrewPicker({ value, onChange, disabled }: { value: string; onChange: (crewId: string) => void; disabled?: boolean }) {
  const { data, user } = useStore();
  const id = useId();
  return (
    <div className={styles.wrap}>
      <label htmlFor={id} className={styles.label}>
        크루
      </label>
      <select id={id} className={styles.select} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {user.managedCrewIds.map((c) => (
          <option key={c} value={c}>
            {getCrew(data, c)?.name} 크루
          </option>
        ))}
      </select>
    </div>
  );
}
