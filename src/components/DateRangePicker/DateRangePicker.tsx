import { useEffect, useRef, useState } from 'react';
import type { FieldControlProps } from '../Field/Field';
import styles from './DateRangePicker.module.css';

/** 'YYYY-MM-DD' 두 개. 빈 값은 정하지 않은 것 */
export interface DayRange {
  from: string;
  to: string;
}

interface Props {
  control: FieldControlProps;
  value: DayRange;
  onChange: (next: DayRange) => void;
  /** 처음 펼칠 달 (값이 없을 때). 'YYYY-MM-DD' */
  today: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toDay = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m: m - 1, d };
};
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export function formatDayLabel(day: string, thisYear: number): string {
  const { y, m, d } = parse(day);
  return `${y === thisYear ? '' : `${y}년 `}${m + 1}월 ${d}일`;
}

/**
 * 기간(선택) 하나로 고르기 (E3, 사용자 확정 견본): 칸을 누르면 달력이 열리고, 시작일 → 끝날짜를 차례로 누르면 기간이 정해진다.
 * 끝날짜를 시작일보다 앞으로 누르면 둘을 바꿔 순서대로 맞춘다. 고를 때마다 바로 적용한다(시작일만 고르면 '시작일부터').
 * Esc·바깥 누르기로 닫고, 닫으면 칸으로 초점을 돌린다.
 */
export function DateRangePicker({ control, value, onChange, today }: Props) {
  const [open, setOpen] = useState(false);
  const base = parse(value.from || today);
  const [view, setView] = useState({ y: base.y, m: base.m });
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const thisYear = parse(today).y;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };

  const pick = (day: string) => {
    if (!value.from || value.to) onChange({ from: day, to: '' });
    else if (day < value.from) onChange({ from: day, to: value.from });
    else {
      onChange({ from: value.from, to: day });
      close();
    }
  };

  const label =
    value.from && value.to
      ? `${formatDayLabel(value.from, thisYear)} ~ ${formatDayLabel(value.to, thisYear)}`
      : value.from
        ? `${formatDayLabel(value.from, thisYear)} ~`
        : '';

  const first = new Date(view.y, view.m, 1).getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const move = (delta: number) => setView(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }));
  const hint = !value.from || value.to ? '시작일을 고르세요' : '끝날짜를 고르세요';

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        id={control.id}
        aria-describedby={control['aria-describedby']}
        aria-invalid={control['aria-invalid']}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`${control.className} ${styles.trigger}`}
        onClick={() => {
          if (!open) {
            const b = parse(value.from || today);
            setView({ y: b.y, m: b.m });
          }
          setOpen(!open);
        }}
      >
        <span className={label ? undefined : styles.placeholder}>{label || '시작일 ~ 끝날짜'}</span>
        <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      </button>
      {open && (
        <div
          className={styles.pop}
          role="dialog"
          aria-label="기간 고르기"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
            }
          }}
        >
          <div className={styles.head}>
            <button type="button" className={styles.nav} onClick={() => move(-1)} aria-label="이전 달">
              ‹
            </button>
            <span className={styles.month} aria-live="polite">
              {view.y}년 {view.m + 1}월
            </span>
            <button type="button" className={styles.nav} onClick={() => move(1)} aria-label="다음 달">
              ›
            </button>
          </div>
          <div className={styles.grid}>
            {WEEK.map((w) => (
              <span key={w} className={styles.dow} aria-hidden="true">
                {w}
              </span>
            ))}
            {Array.from({ length: first }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = toDay(view.y, view.m, i + 1);
              const edge = day === value.from || day === value.to;
              const inside = !!value.from && !!value.to && day > value.from && day < value.to;
              return (
                <button
                  key={day}
                  type="button"
                  className={styles.day}
                  data-edge={edge || undefined}
                  data-in={inside || undefined}
                  data-today={day === today || undefined}
                  aria-pressed={edge}
                  aria-label={`${view.y}년 ${view.m + 1}월 ${i + 1}일`}
                  onClick={() => pick(day)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className={styles.foot}>
            <span className={styles.hint}>{hint}</span>
            <button
              type="button"
              className={styles.clear}
              disabled={!value.from && !value.to}
              onClick={() => {
                onChange({ from: '', to: '' });
                close();
              }}
            >
              기간 지우기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
