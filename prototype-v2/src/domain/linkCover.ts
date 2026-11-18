/**
 * 제출물 커버 1단계 (사용자 확정 2026-11-18): 유튜브 링크는 유튜브가 공개하는 썸네일, 나머지는 대체 커버.
 * 서버·키 없이 화면에서 링크로 계산한다. 저장 형식은 그대로 (썸네일 주소를 저장하지 않는다).
 */
export interface YouTubeRef {
  id: string;
  shorts: boolean;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** youtube.com/watch?v= · youtu.be/ · youtube.com/shorts/ · m.youtube.com · youtube.com/embed/ · youtube.com/live/ */
export function parseYouTube(raw: string): YouTubeRef | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  let shorts = false;
  if (host === 'youtu.be') id = parts[0] ?? null;
  else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (parts[0] === 'watch') id = u.searchParams.get('v');
    else if (parts[0] === 'shorts') {
      id = parts[1] ?? null;
      shorts = true;
    } else if (parts[0] === 'embed' || parts[0] === 'live') id = parts[1] ?? null;
  }
  return id && YT_ID.test(id) ? { id, shorts } : null;
}

/** 유튜브 공개 썸네일 (480×360, 모든 영상에 있음). 없는 영상은 120×90 회색 그림이 온다 */
export function youTubeThumb(ref: YouTubeRef): string {
  return `https://i.ytimg.com/vi/${ref.id}/hqdefault.jpg`;
}

/** 대체 커버에 쓰는 플랫폼 이름 (주소로 판단) */
export function platformLabel(raw: string): string {
  if (parseYouTube(raw)) return parseYouTube(raw)!.shorts ? '유튜브 쇼츠' : '유튜브';
  let host = '';
  try {
    host = new URL(raw.trim()).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '링크';
  }
  if (host.endsWith('youtube.com') || host === 'youtu.be') return '유튜브';
  if (host.endsWith('instagram.com')) return '인스타그램';
  if (host.endsWith('tiktok.com')) return '틱톡';
  if (host === 'drive.google.com' || host === 'docs.google.com') return '구글 드라이브';
  if (host.endsWith('naver.com')) return '네이버';
  return '링크';
}
