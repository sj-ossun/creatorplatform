import type { InputHTMLAttributes } from 'react';
import styles from './PriceInput.module.css';

/** 숫자만 남기고 천 단위 쉼표를 붙인다. 빈 값은 빈 값(0원과 구분) */
export function formatPriceInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 단가 입력 (UI 개선 C, 사용자 확정): 입력하는 동안 천 단위 쉼표를 붙이고 '원'을 뒤에 둔다.
 * 저장은 숫자로 한다(쉼표는 화면에만). 중간 자리를 고치거나 붙여넣어도 커서는 같은 숫자 뒤에 남는다.
 */
export function PriceInput({ value, onValue, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onValue: (v: string) => void }) {
  return (
    <span className={styles.wrap}>
      <input
        {...rest}
        className={`${className ?? ''} ${styles.input}`}
        inputMode="numeric"
        autoComplete="off"
        value={formatPriceInput(value)}
        onChange={(e) => {
          const el = e.target;
          const pos = el.selectionStart ?? el.value.length;
          const digitsBefore = el.value.slice(0, pos).replace(/\D/g, '').length;
          const next = formatPriceInput(el.value);
          let seen = 0;
          let caret = 0;
          while (caret < next.length && seen < digitsBefore) {
            if (/\d/.test(next[caret])) seen++;
            caret++;
          }
          // 바로 고쳐 쓰고 커서를 같은 숫자 뒤에 둔다 (다음 프레임까지 기다리지 않음)
          el.value = next;
          el.setSelectionRange(caret, caret);
          onValue(next);
        }}
      />
      <span className={styles.unit} aria-hidden="true">
        원
      </span>
    </span>
  );
}
