import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { choiceStyles, ErrorBand, Field, FieldGroup } from '../../components/Field/Field';
import { SAVE_FAILED } from '../../components/FeedbackComposer/FeedbackComposer';
import { Icon } from '../../components/Icon/Icon';
import { ListRow, RowList } from '../../components/ListRow/ListRow';
import { BackToList, PanelHead, SplitView } from '../../components/SplitView/SplitView';
import { Tag } from '../../components/Tag/Tag';
import { FORM_ERROR, type FieldErrors } from '../../domain/commands';
import {
  addComment,
  commentsOf,
  createCommunityPost,
  linkableMissions,
  linkedMissionView,
  postsOfCrew,
  validateCommunityPost,
  type CommunityPostInput,
} from '../../domain/community';
import { getCrew, getUser } from '../../domain/queries';
import { formatDetail, formatList } from '../../domain/time';
import { COMMUNITY_KIND_LABEL, ROLE_LABEL, type CommunityPost, type Mission } from '../../domain/types';
import { useDirty, useStore } from '../../state/AppStore';
import { PageHeader, pageStyles as ps } from '../common/Page';
import { useDetailScroll } from '../common/useDetailScroll';
import styles from './Community.module.css';

/** SC-05 크루 소통 (F-10). 실시간 채팅·첨부·검색·좋아요·수정/삭제는 없다. */
export function CommunityScreen({ crewId }: { crewId: string }) {
  const { data, user, route, navigate } = useStore();
  const r = route.screen === 'community' ? route : { screen: 'community' as const, crewId };
  const posts = postsOfCrew(data, crewId);
  const selected = r.writing ? undefined : posts.find((p) => p.id === r.postId) ?? posts[0];
  const { detailRef, listRef, toDetail, toList } = useDetailScroll();
  const writeLabel = user.role === 'leader' ? '글 쓰기' : '질문 쓰기';
  const startWriting = async () => {
    if (await navigate({ screen: 'community', crewId: crewId, writing: true })) toDetail();
  };

  const list = (
    <div ref={listRef}>
      <PanelHead
        title={`${getCrew(data, crewId)?.name} 크루 글`}
        aside={
          posts.length > 0 && !r.writing ? (
            <Button variant="action" size="sm" onClick={() => void startWriting()}>
              {writeLabel}
            </Button>
          ) : undefined
        }
      />
      {posts.length === 0 ? (
        <EmptyState
          title="아직 올라온 글이 없어요"
          action={
            !r.writing && (
              <Button variant="action" onClick={() => void startWriting()}>
                {writeLabel}
              </Button>
            )
          }
        >
          {r.writing ? '글 쓰기 칸에서 첫 글을 써 보세요.' : '궁금한 점을 크루에 물어보세요.'}
        </EmptyState>
      ) : (
        <RowList label="크루 글 목록">
          {posts.map((p) => {
            const count = commentsOf(data, p.id).length;
            return (
              <ListRow
                key={p.id}
                selected={selected?.id === p.id}
                onSelect={async () => {
                  if (await navigate({ screen: 'community', crewId: crewId, postId: p.id })) toDetail();
                }}
                leading={<Tag variant={p.kind === 'notice' ? 'notice' : 'default'}>{COMMUNITY_KIND_LABEL[p.kind]}</Tag>}
                indentMeta={false}
                title={p.title}
                meta={
                  <span>
                    {getUser(data, p.authorId)?.name}, <time dateTime={p.createdAt}>{formatList(p.createdAt)}</time>, 댓글{' '}
                    <span className="num">{count}</span>
                  </span>
                }
              />
            );
          })}
        </RowList>
      )}
    </div>
  );

  let detail;
  if (r.writing) {
    detail = (
      <>
        <BackToList onClick={toList} />
        <PostForm onCancel={() => void navigate({ screen: 'community', crewId: crewId })} />
      </>
    );
  } else if (selected) {
    detail = (
      <>
        <BackToList onClick={toList} />
        <PostDetail key={selected.id} post={selected} />
      </>
    );
  } else {
    detail = <EmptyState title="아직 올라온 글이 없어요">글을 올리면 여기에서 읽고 댓글을 달 수 있어요.</EmptyState>;
  }

  return (
    <div className={ps.screen}>
      <PageHeader title="크루 소통">
        <span>같은 크루 구성원 모두에게 보여요. 제출물과 피드백은 여기에 나오지 않아요.</span>
      </PageHeader>
      <SplitView ref={detailRef} list={list} detail={detail} listLabel="크루 글 목록" detailLabel="글 상세" />
    </div>
  );
}

function PostDetail({ post }: { post: CommunityPost }) {
  const { data, user } = useStore();
  const author = getUser(data, post.authorId);
  const comments = commentsOf(data, post.id);
  return (
    <article className={ps.detail} aria-labelledby="post-detail-title">
      <div className={ps.detailHead}>
        <div className={ps.headRow}>
          <Tag variant={post.kind === 'notice' ? 'notice' : 'default'}>{COMMUNITY_KIND_LABEL[post.kind]}</Tag>
        </div>
        <h2 className={ps.detailTitle} id="post-detail-title">
          {post.title}
        </h2>
        <p className={ps.muted}>
          {author?.name} {author && ROLE_LABEL[author.role]} · <time dateTime={post.createdAt}>{formatDetail(post.createdAt)}</time>
        </p>
      </div>
      <p className={ps.prose}>{post.body}</p>
      <MissionLink post={post} />
      <section className={ps.section} aria-labelledby="comments-title">
        <h3 className={ps.sectionTitle} id="comments-title">
          댓글 <span className="num">{comments.length}</span>
        </h3>
        {comments.length > 0 && (
          <ol className={styles.comments}>
            {comments.map((c) => {
              const a = getUser(data, c.authorId);
              return (
                <li key={c.id} className={styles.comment}>
                  <p className={styles.commentHead}>
                    <strong>{a?.name}</strong> {a && ROLE_LABEL[a.role]} · <time dateTime={c.createdAt}>{formatDetail(c.createdAt)}</time>
                  </p>
                  <p className={ps.prose}>{c.body}</p>
                </li>
              );
            })}
          </ol>
        )}
        <CommentForm key={`${post.id}-${user.id}`} postId={post.id} />
      </section>
    </article>
  );
}

/** 관련 미션 (디자인 6.18). 대상자·담당 크루장만 미션명과 `미션 열기`, 그 외에는 잠금 표시 */
function MissionLink({ post }: { post: CommunityPost }) {
  const { data, user, navigate } = useStore();
  const view = linkedMissionView(data, user, post);
  if (view.kind === 'none') return null;
  if (view.kind === 'locked') {
    return (
      <div className={`${styles.mlink} ${styles.locked}`} aria-label="연결된 미션">
        <span className={styles.mlinkLabel}>
          <Icon name="lock" />
          대상자 전용 미션
        </span>
        <Button size="sm" disabled>
          열 수 없음
        </Button>
      </div>
    );
  }
  const open = (m: Mission) =>
    void navigate({ screen: 'mission', missionId: m.id });
  return (
    <div className={styles.mlink} aria-label="연결된 미션">
      <span className={styles.mlinkLabel}>
        <span className={ps.muted}>연결된 미션</span> {view.mission.title}
      </span>
      <Button size="sm" onClick={() => open(view.mission)}>
        미션 열기
      </Button>
    </div>
  );
}

function CommentForm({ postId }: { postId: string }) {
  const { user, execute, busy, setDirty } = useStore();
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const dirtyKey = `comment-${postId}`;
  useDirty(dirtyKey, body.trim() !== '', '작성 중인 댓글은 사라져요.');

  async function save() {
    setSaveFailed(false);
    const out = await execute((d) => addComment(d, user.id, postId, body, new Date().toISOString()), () => '댓글을 달았어요.');
    if (out.status === 'invalid') setErrors(out.errors);
    else if (out.status === 'save_failed') setSaveFailed(true);
    else if (out.status === 'saved') {
      setDirty(dirtyKey, null);
      setBody('');
      setErrors({});
    }
  }

  return (
    <form
      className={ps.form}
      noValidate
      aria-label="댓글 달기"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field label="댓글 쓰기" error={errors.body} multiline>
        {(p) => (
          <textarea
            {...p}
            name="comment"
            rows={3}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (errors.body && e.target.value.trim()) setErrors({});
            }}
          />
        )}
      </Field>
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      {saveFailed && <ErrorBand>{SAVE_FAILED}</ErrorBand>}
      <div className={ps.actions}>
        {/* 이 화면의 주황은 글 쓰기 흐름 하나 (디자인 7장). 댓글은 보조 버튼 */}
        <Button type="submit" busy={busy}>
          댓글 달기
        </Button>
      </div>
    </form>
  );
}

function PostForm({ onCancel }: { onCancel: () => void }) {
  const { data, user, execute, busy, navigate, setDirty, confirm } = useStore();
  const isLeader = user.role === 'leader';
  const initial: CommunityPostInput = { kind: isLeader ? '' : 'question', title: '', body: '', missionId: '' };
  const [v, setV] = useState<CommunityPostInput>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const missions = linkableMissions(data, user);
  const dirtyKey = 'community-post-form';
  const dirty = v.title !== '' || v.body !== '' || v.missionId !== '' || v.kind !== initial.kind;
  useDirty(dirtyKey, dirty, '작성 중인 글은 사라져요.');

  function update(patch: Partial<CommunityPostInput>) {
    const next = { ...v, ...patch };
    setV(next);
    if (Object.keys(errors).length) {
      const fresh = validateCommunityPost(data, user, next);
      setErrors((prev) => {
        const out: FieldErrors = {};
        for (const k of Object.keys(prev)) if (fresh[k]) out[k] = fresh[k];
        return out;
      });
    }
  }

  async function save() {
    setSaveFailed(false);
    const out = await execute((d) => createCommunityPost(d, user.id, v, new Date().toISOString()), () => '글을 올렸어요.');
    if (out.status === 'invalid') {
      setErrors(out.errors);
      const first = ['kind', 'title', 'body', 'missionId'].find((k) => out.errors[k]);
      if (first) document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
    } else if (out.status === 'save_failed') setSaveFailed(true);
    else if (out.status === 'saved') {
      setDirty(dirtyKey, null);
      await navigate({ screen: 'community', crewId: user.crewId!, postId: out.value.id });
    }
  }

  return (
    <form
      className={ps.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2 className={ps.detailTitle}>{isLeader ? '글 쓰기' : '질문 쓰기'}</h2>
      {isLeader && (
        <FieldGroup legend="글 구분" error={errors.kind}>
          {() => (
            <div className={choiceStyles.choicesRow}>
              {(['notice', 'question'] as const).map((k, i) => (
                <label key={k} className={choiceStyles.choice}>
                  <input
                    type="radio"
                    name="community-kind"
                    value={k}
                    data-field={i === 0 ? 'kind' : undefined}
                    checked={v.kind === k}
                    onChange={() => update({ kind: k })}
                  />
                  {COMMUNITY_KIND_LABEL[k]}
                </label>
              ))}
            </div>
          )}
        </FieldGroup>
      )}
      <Field label="제목" error={errors.title}>
        {(p) => <input {...p} data-field="title" name="community-title" value={v.title} onChange={(e) => update({ title: e.target.value })} />}
      </Field>
      <Field label="본문" error={errors.body} multiline>
        {(p) => <textarea {...p} data-field="body" name="community-body" rows={6} value={v.body} onChange={(e) => update({ body: e.target.value })} />}
      </Field>
      <Field
        label="관련 미션"
        optional
        error={errors.missionId}
        help="미션 대상자와 담당 크루장만 연결된 미션을 열 수 있어요. 다른 구성원에게는 ‘대상자 전용 미션’으로 보여요."
      >
        {(p) => (
          <select {...p} data-field="missionId" name="community-mission" value={v.missionId} onChange={(e) => update({ missionId: e.target.value })}>
            <option value="">연결하지 않음</option>
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        )}
      </Field>
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      {saveFailed && <ErrorBand>{SAVE_FAILED}</ErrorBand>}
      <div className={ps.actions}>
        <Button type="submit" variant="action" busy={busy}>
          올리기
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            if (dirty) {
              const go = await confirm({ title: '저장하지 않고 닫을까요?', body: '작성 중인 글은 사라져요.', stayLabel: '계속 작성', goLabel: '닫기' });
              if (!go) return;
              setDirty(dirtyKey, null);
            }
            onCancel();
          }}
        >
          취소
        </Button>
      </div>
    </form>
  );
}
