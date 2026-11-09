import type { ReactNode } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './Tag.module.css';

export type TagVariant = 'default' | 'sim' | 'notice' | 'internal';

export function Tag({ variant = 'default', children }: { variant?: TagVariant; children: ReactNode }) {
  return (
    <span className={`${styles.tag} ${styles[variant]}`}>
      {variant === 'internal' && <Icon name="lock" />}
      {children}
    </span>
  );
}
