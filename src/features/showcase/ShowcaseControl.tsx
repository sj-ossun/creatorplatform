import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { ErrorBand, Field } from '../../components/Field/Field';
import { FORM_ERROR, type FieldErrors } from '../../domain/commands';
import { canCurate, designateShowcase, isEligible, removeShowcase, SHOWCASE_COMMENT_MAX, showcaseOf } from '../../domain/showcase';
import { getUser } from '../../domain/queries';
import { ROLE_LABEL, type Deliverable } from '../../domain/types';
import { useDirty, useStore } from '../../state/AppStore';
import styles from './Showcase.module.css';

/**
 * 우수 사례 지정·해제 (크루장: 자기 크루, 관리자: 담당 크루).
 * 검토 완료 + 게시 기록이 있는 결과물만 지정한다. 한 줄 평은 지정한 사람이 쓴다.
 */
export function ShowcaseControl({ deliverable, name }: { deliverable: Deliverable; name: string }) {
  const { data, user, execute, busy, confirm } = useStore();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const dirtyKey = `showcase-${deliverable.id}`;
  useDirty(dirtyKey, open && comment.trim() !== '', '작성 중인 한 줄 평은 사라져요.');
  if (!canCurate(data, user, deliverable)) return null;
  const current = showcaseOf(data, deliverable.id);
  const eligible = isEligible(data, deliverable);

  if (current) {
    const author = getUser(data, current.authorId);
    return (
      <div className={styles.curate} aria-label={`${name} 우수 사례`}>
        <div className={styles.curateHead}>
          <span className={styles.on}>우수 사례로 소개 중</span>
          <Button
            size="sm"
            variant="quiet"
            disabled={busy}
            onClick={async () => {
              const go = await confirm({
                title: '우수 사례 소개를 그만둘까요?',
                body: '홈 배너와 우수 사례 페이지에서 빠져요. 결과물과 게시 기록은 그대로예요.',
                stayLabel: '계속 소개',
                goLabel: '소개 해제',
              });
              if (go) await execute((d) => removeShowcase(d, user.id, deliverable.id), () => '우수 사례 소개를 해제했어요.');
            }}
          >
            소개 해제
          </Button>
        </div>
        <p>
          “{current.comment}” — {author?.name} {author && ROLE_LABEL[author.role]}
        </p>
      </div>
    );
  }
  if (!eligible) return null;
  if (!open) {
    return (
      <div>
        <Button size="sm" onClick={() => setOpen(true)} aria-label={`${name} 우수 사례로 소개`}>
          우수 사례로 소개
        </Button>
      </div>
    );
  }
  return (
    <form
      className={styles.curate}
      noValidate
      aria-label={`${name} 우수 사례 지정`}
      onSubmit={async (e) => {
        e.preventDefault();
        const out = await execute((d) => designateShowcase(d, user.id, deliverable.id, comment, new Date().toISOString()), () => '우수 사례로 소개했어요. 홈과 우수 사례 페이지에 보여요.');
        if (out.status === 'invalid') setErrors(out.errors);
        else if (out.status === 'saved') {
          setOpen(false);
          setComment('');
          setErrors({});
        }
      }}
    >
      <Field label="한 줄 평" error={errors.comment} help={`${SHOWCASE_COMMENT_MAX}자 이내. 공개 페이지에 이름·역할과 함께 보여요.`}>
        {(p) => <input {...p} name="showcase-comment" maxLength={SHOWCASE_COMMENT_MAX + 20} value={comment} onChange={(e) => setComment(e.target.value)} />}
      </Field>
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      <div className={styles.curateHead}>
        <Button type="submit" variant="action" size="sm" busy={busy}>
          소개하기
        </Button>
        <Button size="sm" onClick={() => setOpen(false)} disabled={busy}>
          취소
        </Button>
      </div>
    </form>
  );
}
