import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { choiceStyles, ErrorBand, Field, FieldGroup } from '../../components/Field/Field';
import { SAVE_FAILED } from '../../components/FeedbackComposer/FeedbackComposer';
import { createMission, FORM_ERROR, validateMission, type CreateMissionInput, type FieldErrors } from '../../domain/commands';
import { crewMembers } from '../../domain/queries';
import { useDirty, useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';

const EMPTY: CreateMissionInput = { title: '', criteria: '', format: '', dueLocal: '', targetIds: [] };
const DIRTY_KEY = 'mission-form';

/** SC-01 미션 등록 폼 (F-02) */
export function MissionForm({ onCancel, crewName }: { onCancel: () => void; crewName?: string }) {
  const { data, user, execute, busy, navigate, setDirty, confirm } = useStore();
  const members = crewMembers(data, user.crewId);
  const [values, setValues] = useState<CreateMissionInput>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveFailed, setSaveFailed] = useState(false);

  const dirty =
    values.title !== '' || values.criteria !== '' || values.format !== '' || values.dueLocal !== '' || values.targetIds.length > 0;
  useDirty(DIRTY_KEY, dirty, '작성 중인 미션 내용은 사라져요.');

  function update(patch: Partial<CreateMissionInput>) {
    const next = { ...values, ...patch };
    setValues(next);
    if (Object.keys(errors).length) {
      const fresh = validateMission(data, user, next, new Date().toISOString());
      setErrors((prev) => {
        const out: FieldErrors = {};
        for (const k of Object.keys(prev)) if (fresh[k]) out[k] = fresh[k];
        return out;
      });
    }
  }

  async function save() {
    setSaveFailed(false);
    const out = await execute(
      (d) => createMission(d, user.id, values, new Date().toISOString()),
      (m) => `미션을 등록했어요. 대상자 ${m.targetIds.length}명에게 보여요.`,
    );
    if (out.status === 'invalid') {
      setErrors(out.errors);
      const first = Object.keys(out.errors)[0];
      document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
    } else if (out.status === 'save_failed') {
      setSaveFailed(true);
    } else if (out.status === 'saved') {
      setDirty(DIRTY_KEY, null);
      // 등록 완료 → 해당 미션 퀵 리뷰 P-05 (v0.4 P-03·W-01). 퀵 리뷰에서 미션 상세로 돌아갈 수 있다
      await navigate({ screen: 'review', missionId: out.value.id });
    }
  }

  async function cancel() {
    if (dirty) {
      const go = await confirm({
        title: '저장하지 않고 닫을까요?',
        body: '작성 중인 미션 내용은 사라져요.',
        stayLabel: '계속 작성',
        goLabel: '닫기',
      });
      if (!go) return;
      setDirty(DIRTY_KEY, null);
    }
    onCancel();
  }

  const allSelected = members.length > 0 && members.every((m) => values.targetIds.includes(m.id));

  return (
    <form
      className={ps.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h1 className={ps.detailTitle}>미션 등록</h1>
      {crewName && (
        <p className={ps.note}>
          크루: <strong>{crewName}</strong> (고정)
        </p>
      )}
      <Field label="제목" error={errors.title}>
        {(p) => (
          <input {...p} data-field="title" value={values.title} onChange={(e) => update({ title: e.target.value })} />
        )}
      </Field>
      <Field label="목표·제출 기준" error={errors.criteria} multiline help="크루원이 제출 전에 확인할 목표와 기준을 적어 주세요.">
        {(p) => (
          <textarea
            {...p}
            data-field="criteria"
            rows={5}
            value={values.criteria}
            onChange={(e) => update({ criteria: e.target.value })}
          />
        )}
      </Field>
      <FieldGroup legend="제출 형식" error={errors.format}>
        {() => (
          <div className={choiceStyles.choicesRow}>
            {(
              [
                ['link', '영상 공유 링크'],
                ['text', '텍스트'],
              ] as const
            ).map(([v, label], i) => (
              <label key={v} className={choiceStyles.choice}>
                <input
                  type="radio"
                  name="format"
                  value={v}
                  data-field={i === 0 ? 'format' : undefined}
                  checked={values.format === v}
                  onChange={() => update({ format: v })}
                />
                {label}
              </label>
            ))}
          </div>
        )}
      </FieldGroup>
      <Field label="마감 일시" error={errors.dueAt} help="한국 시간 기준이에요. 지금보다 뒤의 일시를 고르세요.">
        {(p) => (
          <input
            {...p}
            data-field="dueAt"
            type="datetime-local"
            value={values.dueLocal}
            onChange={(e) => update({ dueLocal: e.target.value })}
          />
        )}
      </Field>
      <FieldGroup legend="대상자" error={errors.targetIds}>
        {() => (
          <div className={choiceStyles.choices}>
            <label className={choiceStyles.choice}>
              <input
                type="checkbox"
                data-field="targetIds"
                checked={allSelected}
                onChange={() => update({ targetIds: allSelected ? [] : members.map((m) => m.id) })}
              />
              전체 선택
            </label>
            {members.map((m) => (
              <label key={m.id} className={choiceStyles.choice}>
                <input
                  type="checkbox"
                  checked={values.targetIds.includes(m.id)}
                  onChange={(e) =>
                    update({
                      targetIds: e.target.checked
                        ? [...values.targetIds, m.id]
                        : values.targetIds.filter((id) => id !== m.id),
                    })
                  }
                />
                {m.name}
              </label>
            ))}
          </div>
        )}
      </FieldGroup>

      <p className={ps.note}>등록 후에는 대상과 기한을 바꿀 수 없어요.</p>
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      {saveFailed && <ErrorBand>{SAVE_FAILED}</ErrorBand>}
      <div className={ps.actions}>
        <Button type="submit" variant="action" busy={busy}>
          등록하기
        </Button>
        <Button onClick={() => void cancel()} disabled={busy}>
          취소
        </Button>
      </div>
    </form>
  );
}
