import art from '../../assets/brand/crew-character.webp';
import styles from './Character.module.css';

/**
 * CREW 캐릭터 (v2, 사용자 제공 이미지. 바탕은 투명하게 떼어 냄).
 * 크루원·크루장 홈 환영 상자와 크루방 배너에 쓴다. 장식이므로 화면 읽기 프로그램에서는 건너뛴다.
 */
export function Character({ size = 'welcome' }: { size?: 'welcome' | 'banner' }) {
  return <img src={art} alt="" aria-hidden="true" className={styles.art} data-size={size} width={520} height={614} />;
}
