import { useRef, type InputHTMLAttributes } from 'react';
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
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span className={styles.wrap}>
      <input
        {...rest}
        ref={ref}
        className={`${className ?? ''} ${styles.input}`}
        inputMode="numeric"
        autoComplete="off"
        value={formatPriceInput(value)}
        onChange={(e) => {
          const el = e.target;
          const pos = el.selectionStart ?? el.value.length;
          const digitsBefore = el.value.slice(0, pos).replace(/\D/g, '').length;
          const next = formatPriceInput(el.value);
          onValue(next);
          requestAnimationFrame(() => {
            const input = ref.current;
            if (!input) return;
            let seen = 0;
            let caret = 0;
            while (caret < next.length && seen < digitsBefore) {
              if (/\d/.test(next[caret])) seen++;
              caret++;
            }
            input.setSelectionRange(caret, caret);
          });
        }}
      />
      <span className={styles.unit} aria-hidden="true">
        원
      </span>
    </span>
  );
}
