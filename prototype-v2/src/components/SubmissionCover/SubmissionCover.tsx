import { useState } from 'react';
import { parseYouTube, platformLabel, youTubeThumb } from '../../domain/linkCover';
import styles from './SubmissionCover.module.css';

/**
 * 제출물 커버 (1단계, 사용자 확정 견본 2026-11-18). 16:9.
 *   유튜브 링크: 공개 썸네일(불러오는 동안 회색, 쇼츠는 세로 장면 + 양옆 흐림)
 *   그 밖의 링크·텍스트 제출: 대체 커버(카테고리 색·그림 + 플랫폼 이름)
 *   유튜브인데 그림이 없거나 막힘(비공개·삭제·주소 오류·외부 이미지 차단): '미리보기를 불러올 수 없어요'
 * href 가 있으면 원래 링크를 새 창으로 여는 링크, 없으면 장식(목록 행·기록 줄 안).
 */
interface Props {
  content: string;
  format: 'link' | 'text';
  category?: string | null;
  size?: 'card' | 'big' | 'row' | 'mini';
  /** 링크로 쓸 때의 이름 (예: '민지 2차 제출 영상 유튜브에서 열기') */
  label?: string;
  /** 오른쪽 위 차수 표시 (2차 이상) */
  version?: number;
}

type Loaded = 'loading' | 'ok' | 'fail';

export function SubmissionCover({ content, format, category, size = 'card', label, version }: Props) {
  const yt = format === 'link' ? parseYouTube(content) : null;
  const [loaded, setLoaded] = useState<{ src: string; state: Loaded } | null>(null);
  const src = yt ? youTubeThumb(yt) : '';
  const state: Loaded = !yt ? 'fail' : loaded?.src === src ? loaded.state : 'loading';
  const platform = format === 'text' ? '텍스트 제출' : platformLabel(content);
  const kind = !yt ? 'fallback' : state === 'fail' ? 'fail' : state === 'ok' ? 'yt' : 'loading';
  const small = size === 'mini' || size === 'row';

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) =>
    // 없는 영상은 오류 대신 120×90 회색 그림이 온다
    setLoaded({ src, state: e.currentTarget.naturalWidth <= 120 ? 'fail' : 'ok' });
  const onError = () => setLoaded({ src, state: 'fail' });

  const inner = (
    <>
      {yt && kind !== 'fail' && (
        <>
          {yt.shorts && <img className={styles.blur} src={src} alt="" aria-hidden="true" />}
          <img className={yt.shorts ? styles.frame : styles.img} src={src} alt="" onLoad={onLoad} onError={onError} loading="lazy" referrerPolicy="no-referrer" />
        </>
      )}
      {kind === 'loading' && !small && <span className={styles.loadTxt}>미리보기 불러오는 중</span>}
      {(kind === 'fallback' || kind === 'fail') && (
        <>
          {!small && (
            <span className={styles.fbTxt}>
              <b>{kind === 'fail' ? (size === 'big' ? '미리보기를 불러올 수 없어요' : '불러올 수 없음') : '미리보기 없음'}</b>
              {size === 'big' && <span>{kind === 'fail' ? '비공개·삭제된 영상이거나 주소가 달라요. 링크는 열어 볼 수 있어요.' : '유튜브 링크만 썸네일을 보여줘요.'}</span>}
            </span>
          )}
          <Art kind={kind === 'fail' ? 'fail' : category === '뷰티' ? 'beauty' : category === '푸드' ? 'food' : 'other'} />
        </>
      )}
      {!small && (
        <span className={styles.src} data-light={kind === 'fallback' || kind === 'fail' || undefined}>
          {yt ? <YtIcon /> : null}
          {platform}
        </span>
      )}
      {version && version > 1 && !small && <span className={styles.ver}>{version}차</span>}
      {size === 'big' && kind !== 'fallback' && format === 'link' && <span className={styles.open} aria-hidden="true">{yt ? '유튜브에서 보기' : '링크 열기'} ↗</span>}
      {size === 'big' && kind === 'fallback' && format === 'link' && <span className={styles.open} aria-hidden="true">링크 열기 ↗</span>}
    </>
  );
  const cls = `${styles.cover} ${styles[size]}`;
  const dataProps = { 'data-kind': kind, 'data-cat': category === '뷰티' ? 'beauty' : category === '푸드' ? 'food' : undefined };
  if (label && format === 'link') {
    return (
      <a className={cls} {...dataProps} href={content} target="_blank" rel="noopener noreferrer" aria-label={`${label} (새 창)`}>
        {inner}
      </a>
    );
  }
  return (
    <span className={cls} {...dataProps} aria-hidden="true">
      {inner}
    </span>
  );
}

function YtIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0000" />
      <path d="M10 9v6l5-3z" fill="#fff" />
    </svg>
  );
}

function Art({ kind }: { kind: 'food' | 'beauty' | 'other' | 'fail' }) {
  if (kind === 'fail')
    return (
      <svg className={styles.art} viewBox="0 0 100 90" aria-hidden="true">
        <rect x="14" y="16" width="72" height="54" rx="8" fill="#fff" stroke="#AEB5C2" strokeWidth="3" />
        <path d="M24 60l16-18 12 12 8-8 16 14" stroke="#AEB5C2" strokeWidth="3" fill="none" strokeLinejoin="round" />
        <circle cx="64" cy="32" r="6" fill="#C9CED8" />
        <path d="M20 80 80 10" stroke="#8A93A3" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  if (kind === 'beauty')
    return (
      <svg className={styles.art} viewBox="0 0 100 90" aria-hidden="true">
        <rect x="38" y="46" width="24" height="34" rx="4" fill="#3A2B2B" />
        <rect x="41" y="30" width="18" height="18" rx="2" fill="#E9E2DA" />
        <path d="M43 30V16l14-6v20z" fill="#E2406F" />
      </svg>
    );
  if (kind === 'food')
    return (
      <svg className={styles.art} viewBox="0 0 100 90" aria-hidden="true">
        <path d="M12 44h76a38 34 0 0 1-76 0Z" fill="#FF7A1A" />
        <ellipse cx="50" cy="44" rx="38" ry="9" fill="#FFF1E2" />
        <circle cx="40" cy="42" r="6" fill="#FF6F9C" />
        <circle cx="58" cy="41" r="5" fill="#3FC795" />
        <path d="M42 26c0-6 6-6 6-12M56 26c0-6 6-6 6-12" stroke="#FFB27A" strokeWidth="4" strokeLinecap="round" fill="none" />
      </svg>
    );
  return (
    <svg className={styles.art} viewBox="0 0 100 90" aria-hidden="true">
      <rect x="20" y="18" width="60" height="50" rx="10" fill="#fff" stroke="#20232B" strokeWidth="3" />
      <path d="M44 32v22l18-11z" fill="#FF6E00" />
    </svg>
  );
}
