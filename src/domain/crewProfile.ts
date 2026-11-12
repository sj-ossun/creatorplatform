import { FORM_ERROR, type CommandResult, type FieldErrors } from './commands';
import { getUser } from './queries';
import type { AppData, Crew, ID } from './types';

/**
 * 예시 크루의 사전 등록 카테고리·소개·활동 키워드 (v0.6 디자인 결정).
 * 칸이 없는 이전 저장값은 화면에서 읽을 때만 크루 ID 로 채운다. 저장값을 고쳐 쓰지 않는다.
 * 6-C: 소개·키워드는 공개 '크루 둘러보기'에 보이며, 관리자만 고친다 (사용자 결정).
 */
export const CREW_PRESETS: Record<ID, { category: string; intro: string; keywords: string[] }> = {
  'crew-food': {
    category: '푸드',
    intro: '짧은 음식 콘텐츠를 만들고 미션 피드백으로 첫 장면과 전달력을 다듬는 크루예요.',
    keywords: ['숏폼', '맛집', '첫 장면'],
  },
  'crew-beauty': {
    category: '뷰티',
    intro: '뷰티 제품 사용 과정을 짧은 영상으로 기록하고 서로의 표현을 다듬는 크루예요.',
    keywords: ['제품 리뷰', '사용 과정', '전후 비교'],
  },
};

export const CREW_INTRO_MAX = 80;
export const CREW_KEYWORD_MAX = 3;
export const CREW_KEYWORD_LEN = 10;

export const CREW_PROFILE_ERR = {
  notAllowed: '이 크루를 담당하는 관리자만 소개를 고칠 수 있어요.',
  intro: '크루 소개를 입력해 주세요.',
  introLong: `크루 소개는 ${CREW_INTRO_MAX}자 이내로 써 주세요.`,
  keywordsMany: `키워드는 ${CREW_KEYWORD_MAX}개까지 넣을 수 있어요.`,
  keywordLong: `키워드는 하나에 ${CREW_KEYWORD_LEN}자 이내로 써 주세요.`,
} as const;

export interface CrewProfile {
  category: string | null;
  intro: string | null;
  keywords: string[];
}

export function crewProfile(crew: Crew): CrewProfile {
  const preset = CREW_PRESETS[crew.id];
  return {
    category: crew.category ?? preset?.category ?? null,
    intro: crew.intro ?? preset?.intro ?? null,
    keywords: crew.keywords ?? preset?.keywords ?? [],
  };
}

/** 쉼표로 나눈 키워드 (빈 칸·중복 제거) */
export function parseKeywords(raw: string): string[] {
  return [...new Set(raw.split(',').map((k) => k.trim()).filter(Boolean))];
}

export function updateCrewProfile(data: AppData, actorId: ID, crewId: ID, input: { intro: string; keywords: string }): CommandResult<Crew> {
  const actor = getUser(data, actorId);
  const crew = data.crews.find((c) => c.id === crewId);
  if (!actor || actor.role !== 'admin' || !crew || !actor.managedCrewIds.includes(crewId)) {
    return { ok: false, errors: { [FORM_ERROR]: CREW_PROFILE_ERR.notAllowed } };
  }
  const intro = input.intro.trim();
  const keywords = parseKeywords(input.keywords);
  const errors: FieldErrors = {};
  if (!intro) errors.intro = CREW_PROFILE_ERR.intro;
  else if (intro.length > CREW_INTRO_MAX) errors.intro = CREW_PROFILE_ERR.introLong;
  if (keywords.length > CREW_KEYWORD_MAX) errors.keywords = CREW_PROFILE_ERR.keywordsMany;
  else if (keywords.some((k) => k.length > CREW_KEYWORD_LEN)) errors.keywords = CREW_PROFILE_ERR.keywordLong;
  if (Object.keys(errors).length) return { ok: false, errors };
  const next: Crew = { ...crew, intro, keywords };
  return { ok: true, data: { ...data, crews: data.crews.map((c) => (c.id === crewId ? next : c)) }, value: next };
}
