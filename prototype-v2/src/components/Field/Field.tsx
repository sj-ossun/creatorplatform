import { useId, type ReactNode } from 'react';
import styles from './Field.module.css';

export interface FieldControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  className: string;
}

interface Props {
  label: ReactNode;
  /** 선택 항목이면 라벨 뒤에 (선택) 을 붙인다 */
  optional?: boolean;
  help?: ReactNode;
  error?: string;
  multiline?: boolean;
  /** 라벨과 입력 사이에 둘 도구 (예: 문구 넣기 버튼) */
  tools?: ReactNode;
  children: (control: FieldControlProps) => ReactNode;
}

/** 라벨 → 입력 → 도움말 또는 오류 (디자인 6.4) */
export function Field({ label, optional, help, error, multiline, tools, children }: Props) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, help ? helpId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {optional && <span className={styles.optional}> (선택)</span>}
      </label>
      {tools}
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        className: `${multiline ? styles.textarea : styles.input} ${error ? styles.invalid : ''}`,
      })}
      {error && (
        <p className={styles.error} id={errorId}>
          <span className={styles.errorMark} aria-hidden="true">!</span>
          {error}
        </p>
      )}
      {help && (
        <p className={styles.help} id={helpId}>
          {help}
        </p>
      )}
    </div>
  );
}

/** 라디오·체크 묶음 (fieldset) */
export function FieldGroup({
  legend,
  help,
  error,
  children,
}: {
  legend: ReactNode;
  help?: ReactNode;
  error?: string;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, help ? `${id}-help` : null].filter(Boolean).join(' ') || undefined;
  return (
    <fieldset className={styles.group} aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
      <legend className={styles.label}>{legend}</legend>
      {children(describedBy)}
      {error && (
        <p className={styles.error} id={`${id}-error`}>
          <span className={styles.errorMark} aria-hidden="true">!</span>
          {error}
        </p>
      )}
      {help && (
        <p className={styles.help} id={`${id}-help`}>
          {help}
        </p>
      )}
    </fieldset>
  );
}

/** 저장 실패·폼 오류 띠. 자동으로 사라지지 않는다 (디자인 5.3, 6.17) */
export function ErrorBand({ children }: { children: ReactNode }) {
  return (
    <div className={styles.band} role="alert">
      <span className={styles.errorMark} aria-hidden="true">!</span>
      <span>{children}</span>
    </div>
  );
}

export const choiceStyles = styles;
