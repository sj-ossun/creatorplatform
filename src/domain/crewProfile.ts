import type { Crew, ID } from './types';

/**
 * 예시 크루의 사전 등록 카테고리·소개 (v0.6 디자인 결정).
 * 저장 형식(schemaVersion 3)은 바꾸지 않는다. 카테고리·소개 필드가 없는 이전 저장값은
 * 화면에서 읽을 때만 크루 ID 로 채운다. 저장값을 고쳐 쓰지 않는다.
 */
export const CREW_PRESETS: Record<ID, { category: string; intro: string }> = {
  'crew-food': {
    category: '푸드',
    intro: '짧은 음식 콘텐츠를 만들고 미션 피드백으로 첫 장면과 전달력을 다듬는 크루예요.',
  },
  'crew-beauty': {
    category: '뷰티',
    intro: '뷰티 제품 사용 과정을 짧은 영상으로 기록하고 서로의 표현을 다듬는 크루예요.',
  },
};

export interface CrewProfile {
  category: string | null;
  intro: string | null;
}

export function crewProfile(crew: Crew): CrewProfile {
  const preset = CREW_PRESETS[crew.id];
  return {
    category: crew.category ?? preset?.category ?? null,
    intro: crew.intro ?? preset?.intro ?? null,
  };
}
