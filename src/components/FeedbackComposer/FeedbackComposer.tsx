import { useLayoutEffect, useRef, useState } from 'react';
import { FORM_ERROR, review, validateReview, type FieldErrors } from '../../domain/commands';
import { REVIEW_LABEL, type ReviewResult as Result } from '../../domain/status';
import type { Feedback, ID, SubmissionVersion } from '../../domain/types';
import { useDirty, useStore } from '../../state/AppStore';
import { Button } from '../Button/Button';
import { ErrorBand, Field } from '../Field/Field';
import { StatusChip } from '../StatusChip/StatusChip';
import styles from './FeedbackComposer.module.css';

export const PHRASES = [
  { label: '첫 장면 문구 넣기', text: '첫 장면: 처음 3초 안에 ' },
  { label: '메시지 전달 문구 넣기', text: '메시지 전달: 이 영상에서 전하려는 한 가지가 ' },
  { label: '다음 행동 문구 넣기', text: '다음 행동: 다음 제출에서는 ' },
] as const;

export const SAVE_FAILED = '저장하지 못했어요. 입력한 내용은 그대로 있어요. 다시 저장해 보세요.';

interface Props {
  deliverableId: ID;
  version: SubmissionVersion;
  memberName: string;
  onSaved: (feedback: Feedback) => void;
}

/** 피드백 입력 (디자인 6.10). 최신 버전이 검토 대기일 때만 그린다. */
export function FeedbackComposer({ deliverableId, version, memberName, onSaved }: Props) {
  const { user, execute, busy } = useStore();
  const [result, setResult] = useState<Result | ''>('');
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  /** 문구를 넣은 뒤 커서를 둘 위치. 렌더 직후 바로 적용해 이어지는 입력과 엇갈리지 않게 한다 */
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    const el = textRef.current;
    if (caret === null || !el) return;
    pendingCaret.current = null;
    el.focus();
    el.setSelectionRange(caret, caret);
  }, [comment]);

  useDirty(`review-${version.id}`, result !== '' || comment.trim() !== '', '작성 중인 피드백은 사라져요.');

  function revalidate(next: { result: Result | ''; comment: string }) {
    if (Object.keys(errors).length === 0) return;
    const fresh = validateReview({ deliverableId, versionId: version.id, ...next });
    // 오류가 해소된 입력만 안내를 지운다
    setErrors((prev) => {
      const out: FieldErrors = {};
      for (const k of Object.keys(prev)) if (k === FORM_ERROR || fresh[k]) out[k] = fresh[k] ?? prev[k];
      return out;
    });
  }

  function insertPhrase(text: string) {
    const el = textRef.current;
    const start = el?.selectionStart ?? comment.length;
    const end = el?.selectionEnd ?? comment.length;
    const before = comment.slice(0, start);
    const prefix = before && !before.endsWith('\n') ? '\n' : '';
    const next = before + prefix + text + comment.slice(end);
    setComment(next);
    revalidate({ result, comment: next });
    pendingCaret.current = (before + prefix + text).length;
  }

  async function save() {
    setSaveFailed(false);
    const out = await execute(
      (d) => review(d, user.id, { deliverableId, versionId: version.id, result, comment }, new Date().toISOString()),
      (v) => (v.feedback.result === 'completed' ? '완료로 처리했어요.' : '보완 요청을 남겼어요.'),
    );
    if (out.status === 'invalid') {
      setErrors(out.errors);
      if (out.errors.comment) textRef.current?.focus();
    } else if (out.status === 'save_failed') {
      setSaveFailed(true);
    } else if (out.status === 'saved') {
      onSaved(out.value.feedback);
    }
  }

  const label = result === 'revision_requested' ? '수정 방향' : '피드백';
  const saveLabel =
    result === 'completed' ? '완료 처리' : result === 'revision_requested' ? '보완 요청 남기기' : '처리 결과를 고르세요';

  return (
    <section className={styles.compose} aria-labelledby={`compose-${version.id}`}>
      <h3 className={styles.title} id={`compose-${version.id}`}>
        {version.number}차 제출 검토
      </h3>

      <fieldset className={styles.results} aria-invalid={errors.result ? true : undefined}>
        <legend className={styles.legend}>처리 결과</legend>
        {(['completed', 'revision_requested'] as const).map((r) => (
          <label key={r} className={styles.result} data-result={r} data-checked={result === r || undefined}>
            <input
              type="radio"
              name={`result-${version.id}`}
              value={r}
              checked={result === r}
              onChange={() => {
                setResult(r);
                revalidate({ result: r, comment });
              }}
            />
            <span className="status-glyph" data-status={r} aria-hidden="true" />
            {REVIEW_LABEL[r]}
          </label>
        ))}
      </fieldset>
      {errors.result && <ErrorBand>{errors.result}</ErrorBand>}

      <Field
        label={label}
        optional={result !== 'revision_requested'}
        error={errors.comment}
        multiline
        help={result === 'revision_requested' ? '무엇을 어떻게 고치면 되는지 적어 주세요.' : undefined}
        tools={
          <div className={styles.phrases} role="group" aria-label="자주 쓰는 문구 넣기">
            {PHRASES.map((p) => (
              <Button key={p.label} size="sm" onClick={() => insertPhrase(p.text)} disabled={busy}>
                {p.label}
              </Button>
            ))}
          </div>
        }
      >
        {(p) => (
          <textarea
            {...p}
            ref={textRef}
            rows={5}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              revalidate({ result, comment: e.target.value });
            }}
          />
        )}
      </Field>

      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      {saveFailed && <ErrorBand>{SAVE_FAILED}</ErrorBand>}

      <div className={styles.actions}>
        <Button variant="action" onClick={save} disabled={result === ''} busy={busy}>
          {saveLabel}
        </Button>
        <p className={styles.note}>저장하면 {memberName}에게 보낼 알림 예시가 함께 만들어져요.</p>
      </div>
    </section>
  );
}

/** 처리 직후 읽기 전용 결과 */
export function ReviewResultBox({ feedback }: { feedback: Feedback }) {
  return (
    <section className={styles.resultBox} aria-label="처리 결과">
      <div className={styles.resultHead}>
        <StatusChip status={feedback.result} />
        <span className={styles.resultNote}>방금 처리했어요</span>
      </div>
      {feedback.comment ? (
        <p className={styles.prose}>{feedback.comment}</p>
      ) : (
        <p className={styles.muted}>남긴 설명이 없어요.</p>
      )}
    </section>
  );
}
