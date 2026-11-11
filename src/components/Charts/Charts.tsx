import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { STATUS_LABEL, SUBMISSION_STATUSES, type SubmissionStatus } from '../../domain/status';
import styles from './Charts.module.css';

/**
 * 5단계 그래프. 가는 막대·2px 선·8px 이상 점, 흐린 격자, 값은 글자 색(계열 색 아님).
 * 각 표식에 마우스를 올리면 값이 보이고(title), ‘표로 보기’로 같은 숫자를 표로 볼 수 있다.
 * 데이터 계열은 파랑 하나. 제출 상태 그래프만 상태 색을 쓴다.
 */
export function ChartCard({
  title,
  caption,
  table,
  legend,
  children,
}: {
  title: string;
  caption?: string;
  table: { head: string[]; rows: (string | number)[][] };
  legend?: ReactNode;
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <section className={styles.card} aria-labelledby={`${id}-t`}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title} id={`${id}-t`}>
            {title}
          </h3>
          {caption && <p className={styles.caption}>{caption}</p>}
        </div>
        <button type="button" className={styles.toggle} aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? '그래프로 보기' : '표로 보기'}
        </button>
      </div>
      {asTable ? (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label={`${title} 표`}>
            <thead>
              <tr>
                {table.head.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className={j > 0 ? styles.num : undefined}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {legend}
          <Measure>{children}</Measure>
        </>
      )}
    </section>
  );
}

/** 그래프 폭: 카드 안의 실제 폭을 재서 글자가 줄지 않게 한다 (기본 480) */
const WidthContext = createContext(480);
function useW() {
  return useContext(WidthContext);
}
function Measure({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(480);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref}>
      <WidthContext.Provider value={w}>{children}</WidthContext.Provider>
    </div>
  );
}

const H = 200;
const PAD = { l: 52, r: 16, t: 22, b: 30 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}
const fmt = (n: number) => n.toLocaleString('ko-KR');

/** 한 계열 선 그래프 (시간 순) */
export function LineChart({ points, unit, label }: { points: { x: string; y: number }[]; unit: string; label: string }) {
  const W = useW();
  if (points.length === 0) return <p className={styles.empty}>아직 그릴 기록이 없어요.</p>;
  const max = niceMax(Math.max(...points.map((p) => p.y)));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (points.length === 1 ? iw / 2 : (iw * i) / (points.length - 1));
  const y = (v: number) => PAD.t + ih - (ih * v) / max;
  const last = points[points.length - 1];
  return (
    <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${points.map((p) => `${p.x} ${fmt(p.y)}${unit}`).join(', ')}`}>
      <Grid max={max} />
      <polyline className={styles.line} points={points.map((p, i) => `${x(i)},${y(p.y)}`).join(' ')} />
      {points.map((p, i) => (
        <g key={p.x}>
          <circle className={styles.hit} cx={x(i)} cy={y(p.y)} r={14}>
            <title>{`${p.x} · ${fmt(p.y)}${unit}`}</title>
          </circle>
          <circle className={styles.dot} cx={x(i)} cy={y(p.y)} r={5} />
          <text className={styles.tick} x={x(i)} y={H - 10} textAnchor="middle">
            {p.x}
          </text>
        </g>
      ))}
      <text className={styles.value} x={Math.min(x(points.length - 1), W - PAD.r)} y={Math.max(y(last.y) - 12, 14)} textAnchor="end">
        {fmt(last.y)}
        {unit}
      </text>
    </svg>
  );
}

function Grid({ max }: { max: number }) {
  const W = useW();
  const ih = H - PAD.t - PAD.b;
  return (
    <g>
      {[0, 0.5, 1].map((f) => {
        const yy = PAD.t + ih - ih * f;
        return (
          <g key={f}>
            <line className={f === 0 ? styles.axis : styles.grid} x1={PAD.l} x2={W - PAD.r} y1={yy} y2={yy} />
            <text className={styles.tick} x={PAD.l - 8} y={yy + 4} textAnchor="end">
              {fmt(Math.round(max * f))}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function StatusLegend() {
  return (
    <ul className={styles.legend} aria-hidden="true">
      {SUBMISSION_STATUSES.map((s) => (
        <li key={s}>
          <span className={styles.swatch} data-status={s} />
          {STATUS_LABEL[s]}
        </li>
      ))}
    </ul>
  );
}

/** 주차별 제출 상태 누적 막대 (상태 색 전용) */
export function StatusStackBars({ groups }: { groups: { x: string; counts: Record<SubmissionStatus, number>; total: number }[] }) {
  const W = useW();
  if (groups.length === 0) return <p className={styles.empty}>아직 마감된 미션이 없어요.</p>;
  const max = niceMax(Math.max(...groups.map((g) => g.total)));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const slot = iw / groups.length;
  const bw = Math.min(48, slot * 0.6);
  const order: SubmissionStatus[] = ['completed', 'revision_requested', 'pending_review', 'not_submitted'];
  return (
    <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="주차별 제출 상태 누적 막대">
      <Grid max={max} />
      {groups.map((g, i) => {
        const cx = PAD.l + slot * i + slot / 2;
        let acc = 0;
        return (
          <g key={g.x}>
            {order.map((s) => {
              const v = g.counts[s];
              if (!v) return null;
              const h = (ih * v) / max;
              const yy = PAD.t + ih - ((ih * acc) / max) - h;
              acc += v;
              return (
                <rect key={s} className={styles.seg} data-status={s} x={cx - bw / 2} y={yy + 1} width={bw} height={Math.max(h - 2, 1)}>
                  <title>{`${g.x} · ${STATUS_LABEL[s]} ${v}건`}</title>
                </rect>
              );
            })}
            <text className={styles.tick} x={cx} y={H - 10} textAnchor="middle">
              {g.x}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 가로 막대 (한 계열). 순위가 아니라 주어진 순서대로 그린다 */
export function HBars({ rows, label }: { rows: { label: string; value: number; display: string }[]; label: string }) {
  const W = useW();
  if (rows.length === 0) return <p className={styles.empty}>보여줄 값이 없어요.</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const rowH = 34;
  const h = rows.length * rowH + 8;
  const left = 92;
  const iw = W - left - 70;
  return (
    <svg className={styles.svg} viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`${label}: ${rows.map((r) => `${r.label} ${r.display}`).join(', ')}`}>
      <line className={styles.axis} x1={left} x2={left} y1={4} y2={h - 4} />
      {rows.map((r, i) => {
        const yy = 8 + i * rowH;
        const w = Math.max((iw * r.value) / max, r.value > 0 ? 3 : 0);
        return (
          <g key={r.label}>
            <text className={styles.rowLabel} x={0} y={yy + 17}>
              {r.label}
            </text>
            <rect className={styles.bar} x={left} y={yy + 2} width={w} height={22} rx={4}>
              <title>{`${r.label} · ${r.display}`}</title>
            </rect>
            <text className={styles.value} x={left + w + 8} y={yy + 18}>
              {r.display}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 월별 수익 기록: 지급 완료(진한 파랑) + 지급 예정(연한 파랑) 누적 */
export function RevenueBars({ months }: { months: { x: string; paid: number; scheduled: number }[] }) {
  const W = useW();
  if (months.length === 0) return <p className={styles.empty}>아직 수익 기록이 없어요.</p>;
  const max = niceMax(Math.max(...months.map((m) => m.paid + m.scheduled), 1));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const slot = iw / months.length;
  const bw = Math.min(56, slot * 0.6);
  return (
    <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="월별 수익 기록 합계">
      <Grid max={max} />
      {months.map((m, i) => {
        const cx = PAD.l + slot * i + slot / 2;
        const hp = (ih * m.paid) / max;
        const hs = (ih * m.scheduled) / max;
        const base = PAD.t + ih;
        return (
          <g key={m.x}>
            {m.paid > 0 && (
              <rect className={styles.bar} x={cx - bw / 2} y={base - hp} width={bw} height={hp}>
                <title>{`${m.x} · 지급 완료 ${fmt(m.paid)}원`}</title>
              </rect>
            )}
            {m.scheduled > 0 && (
              <rect className={styles.barLight} x={cx - bw / 2} y={base - hp - hs} width={bw} height={Math.max(hs - 2, 1)}>
                <title>{`${m.x} · 지급 예정 ${fmt(m.scheduled)}원`}</title>
              </rect>
            )}
            <text className={styles.value} x={cx} y={base - hp - hs - 6} textAnchor="middle">
              {fmt(m.paid + m.scheduled)}원
            </text>
            <text className={styles.tick} x={cx} y={H - 10} textAnchor="middle">
              {m.x}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function RevenueLegend() {
  return (
    <ul className={styles.legend} aria-hidden="true">
      <li>
        <span className={styles.swatch} data-kind="paid" />
        지급 완료
      </li>
      <li>
        <span className={styles.swatch} data-kind="scheduled" />
        지급 예정
      </li>
    </ul>
  );
}
