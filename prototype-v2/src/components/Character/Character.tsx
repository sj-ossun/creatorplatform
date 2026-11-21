import camera from '../../assets/brand/quokka-camera.webp';
import laptop from '../../assets/brand/quokka-laptop.webp';
import styles from './Character.module.css';

/**
 * CREW 쿼카 캐릭터 (사용자 제공 이미지, 바탕은 투명하게 떼어 냄. 2026-11-21 교체).
 *   welcome: 로그인 홈 환영 상자 — 카메라·명찰·유튜브 쿼카
 *   banner: 크루방 배너 — 노트북·커피 쿼카 (가로로 긴 그림, 책상은 잘라 냄)
 * 장식이므로 화면 읽기 프로그램에서는 건너뛴다.
 */
const ART = {
  welcome: { src: camera, width: 447, height: 640 },
  banner: { src: laptop, width: 595, height: 411 },
} as const;

export function Character({ size = 'welcome' }: { size?: 'welcome' | 'banner' }) {
  const art = ART[size];
  return <img src={art.src} alt="" aria-hidden="true" className={styles.art} data-size={size} width={art.width} height={art.height} />;
}
