import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { ErrorBand, Field } from '../../components/Field/Field';
import { FORM_ERROR, type FieldErrors } from '../../domain/commands';
import { CREW_INTRO_MAX, CREW_KEYWORD_LEN, CREW_KEYWORD_MAX, crewProfile, updateCrewProfile } from '../../domain/crewProfile';
import { getCrew } from '../../domain/queries';
import { useDirty, useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';

/** 크루 소개 (공개 '크루 둘러보기', 6-C 사용자 결정: 관리자만 고친다) */
export function CrewProfileEditor({ crewId }: { crewId: string }) {
  const { data, user, execute, busy } = useStore();
  const crew = getCrew(data, crewId)!;
  const profile = crewProfile(crew);
  const [open, setOpen] = useState(false);
  const [intro, setIntro] = useState(profile.intro ?? '');
  const [keywords, setKeywords] = useState(profile.keywords.join(', '));
  const [errors, setErrors] = useState<FieldErrors>({});
  useDirty(`crew-profile-${crewId}`, open && (intro !== (profile.intro ?? '') || keywords !== profile.keywords.join(', ')), '고치던 크루 소개는 사라져요.');

  if (!open) {
    return (
      <section className={ps.panelPad} aria-labelledby="crew-profile-title">
        <div className={ps.sectionLead}>
          <h3 className={ps.sectionTitle} id="crew-profile-title">
            공개 크루 소개
          </h3>
          <Button
            size="sm"
            onClick={() => {
              setIntro(profile.intro ?? '');
              setKeywords(profile.keywords.join(', '));
              setErrors({});
              setOpen(true);
            }}
          >
            소개 고치기
          </Button>
        </div>
        <p>{profile.intro ?? '소개가 없어요.'}</p>
        <p className={ps.muted}>{profile.keywords.length ? profile.keywords.map((k) => `#${k}`).join(' ') : '키워드 없음'} · 공개 홈 ‘크루 둘러보기’에 보여요</p>
      </section>
    );
  }
  return (
    <form
      className={ps.panelPad}
      noValidate
      aria-label={`${crew.name} 크루 소개 고치기`}
      onSubmit={async (e) => {
        e.preventDefault();
        const out = await execute((d) => updateCrewProfile(d, user.id, crewId, { intro, keywords }), () => '크루 소개를 저장했어요. 공개 홈 ‘크루 둘러보기’에 보여요.');
        if (out.status === 'invalid') setErrors(out.errors);
        else if (out.status === 'saved') setOpen(false);
      }}
    >
      <h3 className={ps.sectionTitle}>공개 크루 소개</h3>
      <Field label="소개 한 줄" error={errors.intro} help={`${CREW_INTRO_MAX}자 이내`}>
        {(p) => <input {...p} name="crew-intro" data-field="intro" value={intro} onChange={(e) => setIntro(e.target.value)} />}
      </Field>
      <Field label="활동 키워드" optional error={errors.keywords} help={`쉼표로 나눠 ${CREW_KEYWORD_MAX}개까지, 하나에 ${CREW_KEYWORD_LEN}자 이내`}>
        {(p) => <input {...p} name="crew-keywords" data-field="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} />}
      </Field>
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      <div className={ps.actions}>
        <Button type="submit" variant="action" size="sm" busy={busy}>
          저장
        </Button>
        <Button size="sm" onClick={() => setOpen(false)} disabled={busy}>
          취소
        </Button>
      </div>
    </form>
  );
}
