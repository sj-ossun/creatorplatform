import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'action' | 'secondary' | 'strong' | 'quiet';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  /** 저장 중. 실제 disabled 와 aria-busy 를 함께 쓴다 (디자인 6.3) */
  busy?: boolean;
  busyLabel?: string;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
  variant = 'secondary',
  size = 'md',
  busy = false,
  busyLabel = '저장 중',
  disabled,
  className,
  children,
  type = 'button',
  ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[styles.btn, styles[variant], size === 'sm' ? styles.sm : '', className ?? ''].join(' ')}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
});
