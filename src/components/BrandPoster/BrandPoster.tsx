import styles from './BrandPoster.module.css';

/**
 * BrandPoster (v0.6 04 6·7장): 실제 포스터 원본이 없을 때 쓰는 타이포그래피·육각 도형 콘셉트 그래픽.
 * 로고 주황 바탕 + 진한 글자 (흰 글자는 대비 부족). 핵심 설명은 홈 본문에 따로 있다.
 * 원본 포스터가 확정되면 이 컴포넌트만 이미지로 바꾼다.
 */
export function BrandPoster({ pair = false }: { pair?: boolean }) {
  return (
    <figure className={`${styles.poster} ${pair ? styles.pair : ''}`} aria-label="CREW 콘셉트 포스터: 만들고, 배우고, 함께 성장해요">
      <svg className={styles.shapes} viewBox="0 0 400 440" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <polygon className={styles.hexSoft} points="300,20 386,70 386,170 300,220 214,170 214,70" />
        <polygon className={styles.hexLine} points="330,230 400,270 400,350 330,390 260,350 260,270" />
        <polygon className={styles.hexLine} points="70,300 130,335 130,405 70,440 10,405 10,335" />
        <polygon className={styles.hexDark} points="210,320 236,335 236,365 210,380 184,365 184,335" />
      </svg>
      <div className={styles.words} aria-hidden="true">
        <span>CREATE</span>
        <span>LEARN</span>
        <span>TOGETHER</span>
      </div>
      <figcaption className={styles.caption}>CREW · 콘셉트 그래픽 (가칭)</figcaption>
    </figure>
  );
}
