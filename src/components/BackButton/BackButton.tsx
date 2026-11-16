import { useStore } from '../../state/AppStore';
import styles from './BackButton.module.css';

/**
 * E2 '← 이전 페이지': 홈이 아닌 화면 맨 위 왼쪽. 앱 안에서 지나온 화면으로 한 단계 돌아간다.
 * 돌아갈 기록이 없으면(처음 연 화면) 보이지 않는다.
 */
export function BackButton() {
  const { route, canGoBack, goBack, busy } = useStore();
  if (route.screen === 'home' || !canGoBack) return null;
  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.back} disabled={busy} onClick={() => void goBack()}>
        <span aria-hidden="true">←</span> 이전 페이지
      </button>
    </div>
  );
}
