import lockup from '../../assets/brand/th-lockup.png';
import styles from './SiteFooter.module.css';

/** 모든 화면 공통 푸터: 운영사 로고와 시연 범위 안내 (v0.6 디자인 결정: 헤더 '나' 안) */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.org}>
          <span className={styles.label}>운영</span>
          <img src={lockup} alt="Treasure Hunter" className={styles.lockup} width={180} height={38} />
        </p>
        <p className={styles.note}>
          CREW(가칭) · 시연 프로토타입. 시연용 가상 계정으로 로그인하며 실제 인증·알림 발송·정산은 하지 않아요. 기록은 이 브라우저에만 저장돼요.
        </p>
      </div>
    </footer>
  );
}
