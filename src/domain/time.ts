import type { Instant } from './types';

const TZ = 'Asia/Seoul';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function parts(iso: Instant) {
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(iso))) out[p.type] = p.value;
  return out;
}

function yearOf(iso: Instant) {
  return parts(iso).year;
}

/** 상세: `11월 8일(일) 21:40`, 해가 다르면 앞에 `2025년` */
export function formatDetail(iso: Instant, now: Instant = new Date().toISOString()): string {
  const p = parts(iso);
  const year = p.year !== yearOf(now) ? `${p.year}년 ` : '';
  return `${year}${p.month}월 ${p.day}일(${p.weekday}) ${p.hour}:${p.minute}`;
}

/** 목록: `11월 8일 21:40` */
export function formatList(iso: Instant, now: Instant = new Date().toISOString()): string {
  const p = parts(iso);
  const year = p.year !== yearOf(now) ? `${p.year}년 ` : '';
  return `${year}${p.month}월 ${p.day}일 ${p.hour}:${p.minute}`;
}

/**
 * datetime-local 값(`2026-11-12T18:00`)을 한국 시간으로 해석한다.
 * 브라우저(호스트) 시간대는 쓰지 않는다. 형식이 틀리면 null.
 */
export function parseKstLocal(value: string): Instant | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((v) => (v === undefined ? 0 : Number(v)));
  const utc = Date.UTC(y, mo - 1, d, h, mi, s) - KST_OFFSET_MS;
  const check = new Date(utc + KST_OFFSET_MS);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    h > 23 ||
    mi > 59
  ) {
    return null;
  }
  return new Date(utc).toISOString();
}

/** Instant → datetime-local 값(한국 시간) */
export function toKstLocal(iso: Instant): string {
  const t = new Date(new Date(iso).getTime() + KST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(
    t.getUTCHours(),
  )}:${pad(t.getUTCMinutes())}`;
}

export function isAfter(a: Instant, b: Instant) {
  return new Date(a).getTime() > new Date(b).getTime();
}

export function formatCount(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n);
}

/** YYYY-MM-DD (한국 시간 날짜)가 실제 날짜인지 */
export function isValidDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && parseKstLocal(`${day}T00:00`) !== null;
}

/** 날짜만: `11월 2일`, 해가 다르면 `2025년 11월 2일` */
export function formatDay(day: string, now: Instant = new Date().toISOString()): string {
  const [y, m, d] = day.split('-').map(Number);
  const year = String(y) !== yearOf(now) ? `${y}년 ` : '';
  return `${year}${m}월 ${d}일`;
}

/** 지금의 한국 날짜 (YYYY-MM-DD) */
export function todayKst(now: Instant = new Date().toISOString()): string {
  return toKstLocal(now).slice(0, 10);
}
