import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button/Button';
import { ErrorBand, Field } from '../../components/Field/Field';
import { SAVE_FAILED } from '../../components/FeedbackComposer/FeedbackComposer';
import { FORM_ERROR, submit, validateSubmission, type FieldErrors } from '../../domain/commands';
import { isAfter } from '../../domain/time';
import type { Mission } from '../../domain/types';
import { useDirty, useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';

interface Props {
  mission: Mission;
  resubmit: boolean;
  onClose: (saved: boolean) => void;
  /** UI 개선 B: 미션 상세에 처음부터 펼쳐 둔 폼. 자동 초점·취소 버튼이 없다 */
  inline?: boolean;
}

/** 최초 제출(F-03)·수정본 제출(F-06). 미션 상세에서는 처음부터 펼쳐 둔다(inline). */
export function SubmitForm({ mission, resubmit, onClose, inline = false }: Props) {
  const { user, execute, busy, setDirty, confirm } = useStore();
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const firstRef = useRef<HTMLElement | null>(null);
  const dirtyKey = `submit-${mission.id}`;
  const dirty = content.trim() !== '' || description.trim() !== '' || changeNote.trim() !== '';
  useDirty(dirtyKey, dirty, '작성 중인 제출 내용은 사라져요.');

  useEffect(() => {
    if (!inline) firstRef.current?.focus();
  }, [inline]);

  function revalidate(next: { content: string; changeNote: string }) {
    if (Object.keys(errors).length === 0) return;
    const fresh = validateSubmission(mission, { missionId: mission.id, description, ...next }, resubmit);
    setErrors((prev) => {
      const out: FieldErrors = {};
      for (const k of Object.keys(prev)) if (fresh[k]) out[k] = fresh[k];
      return out;
    });
  }

  async function save() {
    setSaveFailed(false);
    const out = await execute(
      (d) => submit(d, user.id, { missionId: mission.id, content, description, changeNote }, new Date().toISOString()),
      () => (resubmit ? '수정본을 제출했어요.' : '제출했어요. 크루장 검토를 기다리고 있어요.'),
    );
    if (out.status === 'invalid') {
      setErrors(out.errors);
      const first = ['changeNote', 'content'].find((k) => out.errors[k]);
      if (first) document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
    } else if (out.status === 'save_failed') {
      setSaveFailed(true);
    } else if (out.status === 'saved') {
      setDirty(dirtyKey, null);
      setContent('');
      setDescription('');
      setChangeNote('');
      onClose(true);
    }
  }

  async function cancel() {
    if (dirty) {
      const go = await confirm({
        title: '저장하지 않고 닫을까요?',
        body: '작성 중인 제출 내용은 사라져요.',
        stayLabel: '계속 작성',
        goLabel: '닫기',
      });
      if (!go) return;
      setDirty(dirtyKey, null);
    }
    onClose(false);
  }

  const late = isAfter(new Date().toISOString(), mission.dueAt);
  const isLink = mission.format === 'link';

  return (
    <form
      className={ps.form}
      noValidate
      aria-label={resubmit ? '수정본 제출' : '제출'}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {resubmit && (
        <Field
          label="수정한 내용"
          error={errors.changeNote}
          multiline
          help="크루장이 이전 제출과 무엇이 달라졌는지 알 수 있게 적어 주세요."
        >
          {(p) => (
            <textarea
              {...p}
              ref={(el) => {
                firstRef.current = el;
              }}
              data-field="changeNote"
              rows={3}
              value={changeNote}
              onChange={(e) => {
                setChangeNote(e.target.value);
                revalidate({ content, changeNote: e.target.value });
              }}
            />
          )}
        </Field>
      )}
      <Field
        label={isLink ? '영상 링크' : '제출 내용'}
        error={errors.content}
        multiline={!isLink}
        help={
          isLink
            ? '검토용 영상 공유 링크를 넣어 주세요. 주소 형식만 확인하고, 링크가 열리는지는 확인하지 않아요.'
            : undefined
        }
      >
        {(p) =>
          isLink ? (
            <input
              {...p}
              ref={(el) => {
                if (!resubmit) firstRef.current = el;
              }}
              data-field="content"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                revalidate({ content: e.target.value, changeNote });
              }}
            />
          ) : (
            <textarea
              {...p}
              ref={(el) => {
                if (!resubmit) firstRef.current = el;
              }}
              data-field="content"
              rows={6}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                revalidate({ content: e.target.value, changeNote });
              }}
            />
          )
        }
      </Field>
      <Field label="설명" optional multiline>
        {(p) => <textarea {...p} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}
      </Field>

      {late && <p className={ps.info}>마감이 지났어요. 지금 제출해도 되고, ‘기한 후 제출’로 표시돼요.</p>}
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      {saveFailed && <ErrorBand>{SAVE_FAILED}</ErrorBand>}
      <div className={ps.actions}>
        <Button type="submit" variant="action" busy={busy}>
          {resubmit ? '수정본 제출하기' : '제출하기'}
        </Button>
        {!inline && (
          <Button onClick={() => void cancel()} disabled={busy}>
            취소
          </Button>
        )}
      </div>
    </form>
  );
}
