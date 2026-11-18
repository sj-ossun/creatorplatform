import { describe, expect, it } from 'vitest';
import { parseYouTube, platformLabel, youTubeThumb } from './linkCover';

describe('제출물 커버 1단계: 유튜브 링크 알아보기', () => {
  it('일반·짧은 주소·쇼츠·휴대폰·임베드 주소에서 영상 ID를 찾는다', () => {
    expect(parseYouTube('https://www.youtube.com/watch?v=jNQXAC9IVRw&t=3s')).toEqual({ id: 'jNQXAC9IVRw', shorts: false });
    expect(parseYouTube('https://youtu.be/jNQXAC9IVRw?si=abc')).toEqual({ id: 'jNQXAC9IVRw', shorts: false });
    expect(parseYouTube('https://youtube.com/shorts/jNQXAC9IVRw')).toEqual({ id: 'jNQXAC9IVRw', shorts: true });
    expect(parseYouTube('https://m.youtube.com/watch?v=jNQXAC9IVRw')).toEqual({ id: 'jNQXAC9IVRw', shorts: false });
    expect(parseYouTube(' https://www.youtube.com/embed/jNQXAC9IVRw ')).toEqual({ id: 'jNQXAC9IVRw', shorts: false });
    expect(youTubeThumb({ id: 'jNQXAC9IVRw', shorts: false })).toBe('https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg');
  });
  it('유튜브가 아니거나 ID 모양이 틀리면 null (대체 커버)', () => {
    expect(parseYouTube('https://example.com/watch?v=jNQXAC9IVRw')).toBeNull();
    expect(parseYouTube('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(parseYouTube('https://www.youtube.com/@channel')).toBeNull();
    expect(parseYouTube('youtube.com/watch?v=jNQXAC9IVRw')).toBeNull();
    expect(parseYouTube('javascript:alert(1)')).toBeNull();
  });
  it('대체 커버의 플랫폼 이름', () => {
    expect(platformLabel('https://www.instagram.com/reel/abc/')).toBe('인스타그램');
    expect(platformLabel('https://www.tiktok.com/@a/video/1')).toBe('틱톡');
    expect(platformLabel('https://drive.google.com/file/d/x')).toBe('구글 드라이브');
    expect(platformLabel('https://youtube.com/shorts/jNQXAC9IVRw')).toBe('유튜브 쇼츠');
    expect(platformLabel('https://www.youtube.com/@channel')).toBe('유튜브');
    expect(platformLabel('https://example.com/share/minji')).toBe('링크');
    expect(platformLabel('그냥 글')).toBe('링크');
  });
});
