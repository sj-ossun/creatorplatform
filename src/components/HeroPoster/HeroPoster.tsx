import type { ReactNode } from 'react';
import styles from './HeroPoster.module.css';

/**
 * HeroPoster: 홈 첫 화면 포스터 (사용자 결정, 받은 포스터와 같은 느낌으로 새로 그림).
 * 글자는 이미지가 아니라 화면 글자라서 어느 폭에서도 또렷하고, 큰 제목이 곧 페이지 제목(h1)이다.
 * 폭에 따라 두 판을 쓴다 (포스터 자체 폭 기준):
 *   일반 웹판(720px 이상) — 왼쪽 혼자 만드는 사람 · 가운데 글 · 오른쪽 함께하는 크루, 가로로 긴 배너
 *   모바일 세로판(720px 미만) — 글과 단계를 위에, 그림 두 장면을 아래에 나란히 쌓은 세로 포스터
 * 그림은 장식(aria-hidden)이고, 실제 버튼은 children 으로 받는다 (그림 리본을 버튼처럼 보이게 하지 않음).
 */
export function HeroPoster({ titleId, children }: { titleId: string; children?: ReactNode }) {
  return (
    <section className={styles.poster} aria-labelledby={titleId} data-testid="hero-poster">
      <div className={styles.frame}>
        <Decor />
        <div className={styles.layout}>
          <SoloArt />
          <div className={styles.center}>
            <p className={styles.eyebrow}>크리에이터 크루 플랫폼</p>
            <h1 className={styles.title} id={titleId}>
              <span className={styles.line}>혼자 만드는 콘텐츠에서,</span>{' '}
              <span className={styles.line}>
                <em>함께 성장</em>하는 <em>크루</em>로.
              </span>
            </h1>
            <ol className={styles.steps} aria-label="크루 활동 흐름">
              <li className={styles.step}>
                <FlagIcon />
                <span>미션 확인</span>
              </li>
              <li className={styles.step}>
                <TalkIcon />
                <span>피드백 나누기</span>
              </li>
              <li className={styles.step}>
                <RecordIcon />
                <span>활동 기록 이어가기</span>
              </li>
            </ol>
            {children && <div className={styles.cta}>{children}</div>}
            <p className={styles.tagline} aria-hidden="true">
              START YOUR CREW JOURNEY
            </p>
          </div>
          <CrewArt />
        </div>
      </div>
    </section>
  );
}

/** 배경 점·카메라 (모서리에만 두어 글과 겹치지 않음) */
function Decor() {
  return (
    <div className={styles.decor} aria-hidden="true">
      <span className={styles.dot} style={{ top: '9%', left: '13%', background: 'var(--p-teal-soft)' }} />
      <span className={styles.dot} style={{ top: '16%', right: '18%', background: 'var(--p-coral)' }} />
      <span className={styles.dot} style={{ top: '46%', left: '6%', background: 'var(--p-teal)' }} />
      <span className={styles.dot} style={{ top: '30%', right: '6%', background: 'var(--p-teal)' }} />
      <svg className={styles.camera} viewBox="0 0 64 48">
        <rect x="2" y="10" width="60" height="36" rx="7" fill="var(--p-teal)" />
        <rect x="18" y="3" width="20" height="10" rx="3" fill="var(--p-teal)" />
        <circle cx="32" cy="28" r="12" fill="var(--p-paper)" />
        <circle cx="32" cy="28" r="8" fill="var(--p-navy)" />
        <circle cx="51" cy="18" r="2.5" fill="var(--p-paper)" />
      </svg>
    </div>
  );
}

/** 혼자 노트북 앞에 앉은 사람 (진한 실루엣) */
function SoloArt() {
  return (
    <svg className={`${styles.art} ${styles.solo}`} viewBox="0 0 240 220" aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      <path
        d="M58 74 C56 34 118 28 120 72 C122 104 128 128 146 142 C124 146 108 138 102 124 L80 124 C72 140 54 148 34 144 C52 130 60 104 58 74Z"
        fill="var(--p-navy)"
      />
      <circle cx="89" cy="74" r="27" fill="var(--p-navy)" />
      <path d="M28 214 C28 150 56 128 90 126 C124 128 150 150 150 214Z" fill="var(--p-navy)" />
      <path d="M122 206 L142 128 L222 128 L206 206Z" fill="var(--p-navy)" />
      <circle cx="180" cy="166" r="5" fill="var(--p-paper)" />
      <rect x="70" y="204" width="160" height="8" rx="3" fill="var(--p-navy)" />
      <rect x="0" y="214" width="240" height="3" rx="1.5" fill="var(--p-navy)" opacity="0.8" />
    </svg>
  );
}

/** 함께하는 크루 (옅은 청록 실루엣 여럿) + CREW WORK 화면 + 반짝임 */
function CrewArt() {
  const person = (x: number, y: number, s: number, o: number, hair?: boolean) => (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
      {hair && <path d="M-26 -4 C-28 -40 28 -42 26 -4 C28 18 32 30 40 38 L-40 38 C-32 30 -28 18 -26 -4Z" fill="var(--p-teal)" />}
      <circle cx="0" cy="-8" r="22" fill="var(--p-teal)" />
      <path d="M-46 84 C-46 36 -24 18 0 18 C24 18 46 36 46 84Z" fill="var(--p-teal)" />
    </g>
  );
  return (
    <svg className={`${styles.art} ${styles.crew}`} viewBox="0 0 300 220" aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      <g>
        <rect x="150" y="10" width="128" height="80" rx="4" fill="var(--p-paper)" stroke="var(--p-navy-soft)" strokeWidth="3" />
        <path d="M160 22 h10 M160 22 v10 M268 22 h-10 M268 22 v10 M160 78 h10 M160 78 v-10 M268 78 h-10 M268 78 v-10" stroke="var(--p-coral)" strokeWidth="2.5" />
        <text x="214" y="46" textAnchor="middle" className={styles.boardText}>
          CREW
        </text>
        <text x="214" y="70" textAnchor="middle" className={styles.boardText}>
          WORK
        </text>
      </g>
      {person(232, 112, 1, 0.45)}
      {person(70, 122, 0.95, 0.5, true)}
      {person(176, 138, 1, 0.75, true)}
      {person(118, 150, 0.9, 0.9)}
      <path d="M210 214 L222 170 L270 170 L262 214Z" fill="var(--p-navy)" />
      <circle cx="244" cy="192" r="3.5" fill="var(--p-paper)" />
      <rect x="196" y="212" width="80" height="5" rx="2" fill="var(--p-navy)" />
      <path d="M284 112 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4Z" fill="var(--p-paper)" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="9" y="5" width="3.5" height="31" rx="1.5" fill="var(--p-navy)" />
      <path d="M12.5 7 H32 L27 14 L32 21 H12.5Z" fill="var(--p-coral)" />
    </svg>
  );
}

function TalkIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M4 8 h20 a4 4 0 0 1 4 4 v8 a4 4 0 0 1 -4 4 h-12 l-6 5 v-5 a4 4 0 0 1 -2 -4 v-8 a4 4 0 0 1 4 -4Z" fill="var(--p-coral)" />
      <path d="M18 18 h14 a4 4 0 0 1 4 4 v7 a4 4 0 0 1 -2 3.5 v4.5 l-5 -4 h-11 a4 4 0 0 1 -4 -4 v-7 a4 4 0 0 1 4 -4Z" fill="var(--p-teal)" />
      <circle cx="11" cy="16" r="1.6" fill="var(--p-paper)" />
      <circle cx="16" cy="16" r="1.6" fill="var(--p-paper)" />
      <circle cx="21" cy="16" r="1.6" fill="var(--p-paper)" />
    </svg>
  );
}

function RecordIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M3 26 H37" stroke="var(--p-navy)" strokeWidth="2.5" />
      <circle cx="7" cy="26" r="3.5" fill="var(--p-coral)" />
      <circle cx="17" cy="26" r="3.5" fill="var(--p-teal)" />
      <circle cx="27" cy="26" r="3.5" fill="var(--p-coral)" />
      <circle cx="35" cy="26" r="3" fill="var(--p-navy)" />
      <path d="M17 5 a6 6 0 0 1 6 6 c0 4 -6 9 -6 9 s-6 -5 -6 -9 a6 6 0 0 1 6 -6Z" fill="var(--p-teal)" />
      <path d="M14.5 11 l2 2 3.5 -4" stroke="var(--p-paper)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <rect x="11" y="32" width="14" height="4" rx="2" fill="var(--p-teal-soft)" />
    </svg>
  );
}
