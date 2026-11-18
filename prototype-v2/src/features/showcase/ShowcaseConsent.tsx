import { Button } from '../../components/Button/Button';
import { answerShowcaseConsent, consentOf, showcaseOf, withdrawShowcaseConsent } from '../../domain/showcase';
import { getUser } from '../../domain/queries';
import { ROLE_LABEL, SHOWCASE_CONSENT_LABEL, type Deliverable } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import styles from './Showcase.module.css';

/**
 * 크리에이터의 우수 사례 공개 동의 (6-C, 사용자 결정). 지정한 사람이 쓴 두 문구를 보고 동의·거절한다.
 * 동의한 뒤에도 언제든 철회할 수 있고, 철회하면 공개 홈과 우수 사례 페이지에서 바로 내려간다.
 */
export function ShowcaseConsent({ deliverable }: { deliverable: Deliverable }) {
  const { data, user, execute, busy, confirm } = useStore();
  const showcase = showcaseOf(data, deliverable.id);
  if (!showcase || deliverable.memberId !== user.id) return null;
  const consent = consentOf(showcase);
  const author = getUser(data, showcase.authorId);
  const now = () => new Date().toISOString();
  return (
    <section className={styles.consentBox} aria-labelledby="showcase-consent-title">
      <div className={styles.curateHead}>
        <h2 id="showcase-consent-title" className={styles.on}>
          우수 사례 공개
        </h2>
        <span className={styles.consentState} data-state={consent}>
          {SHOWCASE_CONSENT_LABEL[consent]}
        </span>
      </div>
      <p>
        {author?.name} {author && ROLE_LABEL[author.role]}이 이 결과물을 우수 사례로 소개하려고 해요. 아래 두 문구로 공개돼요.
      </p>
      <dl className={styles.consentText}>
        <dt>공개 홈 배너 (누구나): 성과 한 줄</dt>
        <dd>{showcase.headline ?? '(성과 한 줄 없음: 미션 제목이 보여요)'}</dd>
        <dt>우수 사례 페이지 (크루 로그인): 학습 포인트</dt>
        <dd>{showcase.comment}</dd>
      </dl>
      <p className={styles.small}>우수 사례 페이지에는 내 이름, 미션 제목, 게시한 콘텐츠 링크와 조회수도 함께 보여요. 검토용 제출물과 피드백은 보이지 않아요.</p>
      {consent === 'pending' && (
        <div className={styles.curateHead}>
          <Button
            variant="action"
            size="sm"
            busy={busy}
            onClick={() => void execute((d) => answerShowcaseConsent(d, user.id, deliverable.id, true, now()), () => '공개에 동의했어요. 홈과 우수 사례 페이지에 보여요.')}
          >
            동의하고 공개
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void execute((d) => answerShowcaseConsent(d, user.id, deliverable.id, false, now()), () => '공개하지 않기로 했어요.')}
          >
            공개하지 않기
          </Button>
        </div>
      )}
      {consent === 'agreed' && (
        <div className={styles.curateHead}>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              const go = await confirm({
                title: '공개 동의를 철회할까요?',
                body: '공개 홈과 우수 사례 페이지에서 바로 내려가요. 다시 공개하려면 크루장·관리자가 새로 요청해야 해요.',
                stayLabel: '그대로 공개',
                goLabel: '동의 철회',
              });
              if (go) await execute((d) => withdrawShowcaseConsent(d, user.id, deliverable.id, now()), () => '공개 동의를 철회했어요. 홈과 우수 사례 페이지에서 내려갔어요.');
            }}
          >
            동의 철회
          </Button>
        </div>
      )}
      {consent === 'declined' && <p className={styles.small}>공개하지 않기로 했어요. 어디에도 보이지 않아요.</p>}
      {consent === 'withdrawn' && <p className={styles.small}>동의를 철회했어요. 어디에도 보이지 않아요.</p>}
    </section>
  );
}
