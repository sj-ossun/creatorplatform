import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { choiceStyles, ErrorBand, Field, FieldGroup } from '../../components/Field/Field';
import { SAVE_FAILED } from '../../components/FeedbackComposer/FeedbackComposer';
import { FORM_ERROR, type FieldErrors } from '../../domain/commands';
import { editMission, type EditMissionInput } from '../../domain/missionEdit';
import { crewMembers, deliverableOf, getMission, getUser } from '../../domain/queries';
import { toKstLocal } from '../../domain/time';
import { FORMAT_LABEL } from '../../domain/views';
import { useDirty, useStore } from '../../state/AppStore';
import { MissionCrumbs } from '../common/MissionCrumbs';
import { pageStyles as ps } from '../common/Page';

const DIRTY_KEY = 'mission-edit';

/**
 * E4 미션 고치기 (크루장). 제목·목표·기준·마감 일시를 고치고 대상자를 더한다 (빼기는 없음).
 * 저장하면 미션 상세로 돌아가고, 대상자 알림함에 바뀐 내용이 간다. 이전 내용은 미션 상세의 '고친 이력'에 남는다.
 */
export function MissionEditPage({ missionId }: { missionId: string }) {
  const { data, user, execute, busy, navigate, setDirty, confirm } = useStore();
  const mission = getMission(data, missionId);
  const [values, setValues] = useState<EditMissionInput>(() => ({
    title: mission?.title ?? '',
    criteria: mission?.criteria ?? '',
    dueLocal: mission ? toKstLocal(mission.dueAt) : '',
    addTargetIds: [],
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const original = mission ? { title: mission.title, criteria: mission.criteria, dueLocal: toKstLocal(mission.dueAt) } : null;
  const dirty = !!original && (values.title !== original.title || values.criteria !== original.criteria || values.dueLocal !== original.dueLocal || values.addTargetIds.length > 0);
  useDirty(DIRTY_KEY, dirty, '고치던 미션 내용은 사라져요.');
  if (!mission) return null;
  const toDetail = () => void navigate({ screen: 'mission', missionId: mission.id });
  const others = crewMembers(data, mission.crewId).filter((m) => !mission.targetIds.includes(m.id));
  const submitted = mission.targetIds.filter((id) => deliverableOf(data, mission.id, id)).length;

  const update = (patch: Partial<EditMissionInput>) => {
    setValues((v) => ({ ...v, ...patch }));
    if (Object.keys(errors).length) setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !(k in patch) && !(k === 'dueAt' && 'dueLocal' in patch))));
  };

  async function save() {
    setSaveFailed(false);
    const out = await execute(
      (d) => editMission(d, user.id, mission!.id, values, new Date().toISOString()),
      () => '미션을 고쳤어요. 대상자 알림함에 바뀐 내용이 가요.',
    );
    if (out.status === 'invalid') {
      setErrors(out.errors);
      const first = Object.keys(out.errors)[0];
      document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
    } else if (out.status === 'save_failed') setSaveFailed(true);
    else if (out.status === 'saved') {
      setDirty(DIRTY_KEY, null);
      await navigate({ screen: 'mission', missionId: mission!.id });
    }
  }

  async function cancel() {
    if (dirty) {
      const go = await confirm({ title: '저장하지 않고 닫을까요?', body: '고치던 미션 내용은 사라져요.', stayLabel: '계속 고치기', goLabel: '닫기' });
      if (!go) return;
      setDirty(DIRTY_KEY, null);
    }
    toDetail();
  }

  return (
    <div className={`${ps.screen} ${ps.reading}`}>
      <MissionCrumbs mission={mission} current="수정" />
      <div className={ps.panelPad}>
        <form
          className={ps.form}
          noValidate
          aria-label="미션 수정"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h1 className={ps.detailTitle}>미션 수정</h1>
          {submitted > 0 && <p className={ps.note}>이미 {submitted}명이 제출했어요. 목표·기준이나 마감을 바꾸면 대상자 모두에게 알림이 가요.</p>}
          <Field label="제목" error={errors.title}>
            {(p) => <input {...p} data-field="title" value={values.title} onChange={(e) => update({ title: e.target.value })} />}
          </Field>
          <Field label="목표·제출 기준" error={errors.criteria} multiline>
            {(p) => <textarea {...p} data-field="criteria" rows={5} value={values.criteria} onChange={(e) => update({ criteria: e.target.value })} />}
          </Field>
          <Field label="마감 일시" error={errors.dueAt} help="한국 시간 기준이에요. 앞당길 수도 있지만 이미 지난 일시로는 바꿀 수 없어요.">
            {(p) => <input {...p} data-field="dueAt" type="datetime-local" value={values.dueLocal} onChange={(e) => update({ dueLocal: e.target.value })} />}
          </Field>
          <dl className={ps.kv}>
            <div>
              <dt>제출 형식</dt>
              <dd>{FORMAT_LABEL[mission.format]} (바꿀 수 없어요)</dd>
            </div>
            <div>
              <dt>지금 대상자</dt>
              <dd>{mission.targetIds.map((id) => getUser(data, id)?.name).join(', ')}</dd>
            </div>
          </dl>
          <FieldGroup legend="대상자 더하기" help="이미 배정된 사람은 뺄 수 없어요. 더한 사람에게는 ‘새 미션 배정’ 알림이 가요.">
            {() =>
              others.length === 0 ? (
                <p className={ps.muted}>크루원이 모두 대상자예요.</p>
              ) : (
                <div className={choiceStyles.choices}>
                  {others.map((m) => (
                    <label key={m.id} className={choiceStyles.choice}>
                      <input
                        type="checkbox"
                        checked={values.addTargetIds.includes(m.id)}
                        onChange={(e) => update({ addTargetIds: e.target.checked ? [...values.addTargetIds, m.id] : values.addTargetIds.filter((id) => id !== m.id) })}
                      />
                      {m.name}
                    </label>
                  ))}
                </div>
              )
            }
          </FieldGroup>
          {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
          {saveFailed && <ErrorBand>{SAVE_FAILED}</ErrorBand>}
          <div className={ps.actions}>
            <Button type="submit" variant="action" busy={busy}>
              고친 내용 저장
            </Button>
            <Button onClick={() => void cancel()} disabled={busy}>
              취소
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
