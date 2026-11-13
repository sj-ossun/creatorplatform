import { useState } from 'react';
import { HelpTitle } from '../../components/HelpTitle/HelpTitle';
import { Breadcrumbs } from '../../components/Breadcrumbs/Breadcrumbs';
import { FilterTabs } from '../../components/FilterTabs/FilterTabs';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { choiceStyles, ErrorBand, Field, FieldGroup } from '../../components/Field/Field';
import { SAVE_FAILED } from '../../components/FeedbackComposer/FeedbackComposer';
import { Icon } from '../../components/Icon/Icon';
import { ListRow, RowList } from '../../components/ListRow/ListRow';
import { MetaParts } from '../../components/MetaParts/MetaParts';
import { Tag } from '../../components/Tag/Tag';
import { FORM_ERROR, type FieldErrors } from '../../domain/commands';
import {
  addComment,
  commentsOf,
  createCommunityPost,
  deleteComment,
  deleteCommunityPost,
  isAnswered,
  kindsFor,
  linkableMissions,
  linkedMissionView,
  postsOfBoard,
  updateComment,
  updateCommunityPost,
  validateCommunityPost,
  type Board,
  type CommunityPostInput,
} from '../../domain/community';
import { getCrew, getUser } from '../../domain/queries';
import { adminNoticesForCrew } from '../../domain/adminNotices';
import { excerpt } from '../../domain/board';
import { NoticeTag } from '../../components/NoticeTag/NoticeTag';
import { formatDateOnly, formatTimeOnly } from '../../domain/time';
import { COMMUNITY_KIND_LABEL, ROLE_LABEL, type CommunityComment, type CommunityPost, type Instant, type Mission } from '../../domain/types';
import { useDirty, useStore } from '../../state/AppStore';
import { COMMUNITY_BOARDS, type Route } from '../../state/routes';
import { pageStyles as ps } from '../common/Page';
import styles from './Community.module.css';

const BOARD_INFO: Record<Board, { title: string; lead: string; empty: string; listLabel: string }> = {
  notice: {
    title: '공지',
    lead: '크루장 공지와 운영팀 공지를 모아 봐요. 운영 공지는 읽기 전용이에요. 문의는 Q&A게시판에 남겨 주세요.',
    empty: '크루장이나 운영팀이 공지를 올리면 여기에 보여요.',
    listLabel: '공지 목록',
  },
  community: {
    title: '자유게시판',
    lead: '크루원끼리 자유롭게 나누고 자랑하는 곳이에요. 우리 크루 구성원에게만 보여요. 공지는 공지 탭에 모여요.',
    empty: '크루에 나누고 싶은 작업이나 소식을 올려 보세요.',
    listLabel: '크루 글 목록',
  },
  qna: {
    title: 'Q&A게시판',
    lead: '크루원이 크루장에게 묻는 곳이에요. 우리 크루 안에서만 보이고, 비공개 질문은 나와 크루장·담당 관리자만 볼 수 있어요.',
    empty: '궁금한 점을 크루장에게 물어보세요.',
    listLabel: '질문 목록',
  },
};

type BoardRoute = Extract<Route, { screen: 'community' | 'qna' | 'notice' }>;

/**
 * P-08 커뮤니티 (사용자 결정): 커뮤니티 한 곳 안에 공지 · 자유게시판 · Q&A게시판 탭 (처음 여는 탭은 자유게시판).
 * 공지 탭은 크루장 공지(댓글 가능)와 운영 공지(관리자, 읽기 전용)를 함께 보여준다. 관리자는 Q&A게시판만 읽기 전용. 목록 → 글 상세·작성·수정은 목록 자리에서 전환한다.
 * 작성자는 자기 글·댓글을 고치고 지울 수 있다. 실시간 채팅·첨부·검색·좋아요는 없다.
 */
export function CommunityScreen({ crewId, board = 'community' }: { crewId: string; board?: Board }) {
  const { data, user, route, navigate } = useStore();
  const r = (route.screen === board ? route : { screen: board, crewId }) as BoardRoute;
  const posts = postsOfBoard(data, user, crewId, board);
  const selected = r.writing ? undefined : posts.find((p) => p.id === r.postId);
  const info = BOARD_INFO[board];
  const go = (patch: Partial<BoardRoute> = {}) => void navigate({ screen: board, crewId, ...patch } as Route);
  const canWrite = kindsFor(user, board).length > 0;
  const writeLabel = board === 'qna' ? '질문하기' : board === 'notice' ? '공지 쓰기' : '글쓰기';
  const adminNotices = board === 'notice' ? adminNoticesForCrew(data, crewId) : [];
  const adminNotice = board === 'notice' && r.screen === 'notice' && r.adminNoticeId ? adminNotices.find((n) => n.id === r.adminNoticeId) : undefined;

  if (adminNotice) {
    return (
      <div className={`${ps.screen} ${ps.reading}`}>
        <BoardCrumbs crewId={crewId} board={board} current={adminNotice.title} />
        <div className={ps.actions}>
          <Button size="sm" onClick={() => go()}>
            목록으로
          </Button>
        </div>
        <div className={ps.panelPad}>
          <article className={ps.detail} aria-labelledby="post-detail-title">
            <div className={ps.detailHead}>
              <div className={ps.headRow}>
                <NoticeTag source="admin" />
                <Tag>읽기 전용</Tag>
              </div>
              <h1 className={ps.detailTitle} id="post-detail-title">
                {adminNotice.title}
              </h1>
              <p className={ps.muted}>
                <PostMeta name="운영팀" at={adminNotice.createdAt} />
              </p>
            </div>
            <p className={ps.prose}>{adminNotice.body}</p>
            <p className={ps.muted}>운영 공지에는 댓글을 달 수 없어요. 궁금한 점은 Q&amp;A게시판에 남겨 주세요.</p>
            {user.role === 'member' && (
              <div className={ps.actions}>
                <Button size="sm" onClick={() => void navigate({ screen: 'qna', crewId, writing: true })}>
                  Q&amp;A게시판에 질문하기
                </Button>
              </div>
            )}
          </article>
        </div>
      </div>
    );
  }

  if (r.writing || (r.editing && selected)) {
    return (
      <div className={`${ps.screen} ${ps.reading}`}>
        <BoardCrumbs crewId={crewId} board={board} current={r.editing ? '글 수정' : writeLabel} />
        <div className={ps.panelPad}>
          <PostForm board={board} editing={r.editing ? selected : undefined} onCancel={() => (r.editing && selected ? go({ postId: selected.id }) : go())} />
        </div>
      </div>
    );
  }

  if (selected) {
    return (
      <div className={`${ps.screen} ${ps.reading}`}>
        <BoardCrumbs crewId={crewId} board={board} current={selected.deletedAt ? '삭제된 글' : selected.title} />
        <div className={ps.actions}>
          <Button size="sm" onClick={() => go()}>
            목록으로
          </Button>
        </div>
        <div className={ps.panelPad}>
          <PostDetail key={selected.id} post={selected} board={board} />
        </div>
      </div>
    );
  }

  // 관리자는 크루 공간 밖에서 Q&A게시판만 읽는다 (탭 없음)
  const tabs = user.role !== 'admin';
  return (
    <div className={`${ps.screen} ${ps.explore}`}>
      <div className={ps.pageHead}>
        <div>
          <HelpTitle className={ps.title} title={tabs ? '커뮤니티' : info.title} help={info.lead} />
          {/* 관리자는 크루 공간 밖에서 열어서 어느 크루인지 늘 보여준다 */}
          {!tabs && <p className={ps.muted}>{getCrew(data, crewId)?.name} 크루 · 읽기 전용</p>}
        </div>
        {canWrite && (
          <Button variant="action" onClick={() => go({ writing: true })}>
            {writeLabel}
          </Button>
        )}
      </div>
      {tabs && (
        <FilterTabs
          label="커뮤니티 게시판"
          idPrefix="board"
          panelId="board-panel"
          items={[...COMMUNITY_BOARDS.map((b) => ({ key: b.board as string, label: b.label })), { key: 'global', label: '전체 크루 게시판' }]}
          selected={board}
          onSelect={(b) => void navigate(b === 'global' ? { screen: 'board' } : ({ screen: b, crewId } as Route))}
        />
      )}
      <div role={tabs ? 'tabpanel' : undefined} id={tabs ? 'board-panel' : undefined} aria-labelledby={tabs ? `board-tab-${board}` : undefined}>
      {posts.length === 0 && adminNotices.length === 0 ? (
        <div className={ps.panel}>
          <EmptyState
            title={board === 'qna' ? '아직 올라온 질문이 없어요' : board === 'notice' ? '아직 올라온 공지가 없어요' : '아직 올라온 글이 없어요'}
            action={
              canWrite && (
                // 한 화면에 주 버튼은 하나: 위쪽 쓰기 버튼이 주 버튼이라 빈 안내 속 버튼은 테두리
                <Button onClick={() => go({ writing: true })}>
                  {writeLabel}
                </Button>
              )
            }
          >
            {info.empty}
          </EmptyState>
        </div>
      ) : (
        <div className={ps.panel}>
          <RowList label={info.listLabel}>
            {[
              ...posts.map((p) => ({ at: p.createdAt, post: p, admin: undefined })),
              ...adminNotices.map((n) => ({ at: n.createdAt, post: undefined, admin: n })),
            ]
              .sort((a, b) => (board === 'notice' ? b.at.localeCompare(a.at) : 0))
              .map(({ post: p, admin }) => {
              if (admin) {
                return (
                  <ListRow
                    key={admin.id}
                    selected={false}
                    onSelect={() => go({ adminNoticeId: admin.id } as Partial<BoardRoute>)}
                    leading={<NoticeTag source="admin" />}
                    indentMeta={false}
                    title={admin.title}
                    trailing={<Tag>읽기 전용</Tag>}
                    meta={<PostMeta name="운영팀" at={admin.createdAt} />}
                  />
                );
              }
              if (!p) return null;
              const count = commentsOf(data, p.id).filter((c) => !c.deletedAt).length;
              return (
                <ListRow
                  key={p.id}
                  selected={false}
                  onSelect={() => go({ postId: p.id })}
                  leading={<KindMark post={p} answered={board === 'qna' ? isAnswered(data, p) : undefined} />}
                  indentMeta={false}
                  title={p.deletedAt ? '삭제된 글이에요' : p.title}
                  meta={
                    board === 'community' && !p.deletedAt ? (
                      // 자유게시판: 본문 앞부분 + … (사용자 확정)
                      <span className={styles.rowMeta}>
                        <span className={styles.excerpt}>{excerpt(p.body)}</span>
                        <PostMeta name={getUser(data, p.authorId)?.name ?? ''} at={p.createdAt} edited={p.updatedAt} comments={count} />
                      </span>
                    ) : (
                      <PostMeta name={getUser(data, p.authorId)?.name ?? ''} at={p.createdAt} edited={p.updatedAt} comments={count} />
                    )
                  }
                />
              );
            })}
          </RowList>
        </div>
      )}
      </div>
    </div>
  );
}

/** 글 구분 표시: 공지는 강조, 일반 글은 표시 없음, 질문은 답변 여부와 비공개 표시 */
function KindMark({ post, answered }: { post: CommunityPost; answered?: boolean }) {
  if (post.kind === 'post') return null;
  if (post.kind === 'notice') return <NoticeTag source="crew" />;
  return (
    <span className={styles.qMarks}>
      <Tag>{answered ? '답변 완료' : '답변 대기'}</Tag>
      {post.private && (
        <Tag variant="internal">
          비공개
        </Tag>
      )}
    </span>
  );
}

function PostMeta({ name, at, edited, comments }: { name: string; at: Instant; edited?: Instant; comments?: number }) {
  return (
    <MetaParts
      items={[
        name,
        <time key="d" dateTime={at}>
          {formatDateOnly(at)}
        </time>,
        <span key="t">{formatTimeOnly(at)}</span>,
        ...(comments !== undefined
          ? [
              <span key="c">
                댓글 <span className="num">{comments}</span>
              </span>,
            ]
          : []),
        ...(edited ? [<span key="e">수정됨</span>] : []),
      ]}
    />
  );
}

function BoardCrumbs({ crewId, board, current }: { crewId: string; board: Board; current: string }) {
  const { data, user, navigate } = useStore();
  return (
    <Breadcrumbs
      items={[
        user.role === 'admin'
          ? // 관리자는 크루 공간 대신 운영 관리의 그 크루로 돌아간다
            { label: `${getCrew(data, crewId)?.name} 크루`, onClick: () => void navigate({ screen: 'overview', crewId }) }
          : { label: '커뮤니티', onClick: () => void navigate({ screen: 'community', crewId }) },
        { label: BOARD_INFO[board].title, onClick: () => void navigate({ screen: board, crewId } as Route) },
        { label: current },
      ]}
    />
  );
}

function PostDetail({ post, board }: { post: CommunityPost; board: Board }) {
  const { data, user, navigate, execute, busy, confirm } = useStore();
  const author = getUser(data, post.authorId);
  const comments = commentsOf(data, post.id);
  const mine = post.authorId === user.id && !post.deletedAt;
  const locked = post.kind === 'question' && isAnswered(data, post);
  const isAdminView = user.role === 'admin';

  if (post.deletedAt) {
    return (
      <article className={ps.detail} aria-label="삭제된 글">
        <p className={ps.muted}>작성자가 삭제한 글이에요. 남은 댓글만 보여요.</p>
        <Comments post={post} comments={comments} board={board} canComment={false} />
      </article>
    );
  }

  return (
    <article className={ps.detail} aria-labelledby="post-detail-title">
      <div className={ps.detailHead}>
        {post.kind !== 'post' && (
          <div className={ps.headRow}>
            <KindMark post={post} answered={board === 'qna' ? locked : undefined} />
          </div>
        )}
        <h1 className={ps.detailTitle} id="post-detail-title">
          {post.title}
        </h1>
        <p className={ps.muted}>
          <PostMeta
            name={`${author?.name ?? ''} ${author ? ROLE_LABEL[author.role] : ''}`.trim()}
            at={post.createdAt}
            edited={post.updatedAt}
            comments={comments.filter((c) => !c.deletedAt).length}
          />
        </p>
      </div>
      <p className={ps.prose}>{post.body}</p>
      <MissionLink post={post} />
      {mine && (
        <div className={ps.actions}>
          <Button
            size="sm"
            disabled={busy || locked}
            onClick={() => void navigate({ screen: board, crewId: post.crewId, postId: post.id, editing: true } as Route)}
          >
            수정
          </Button>
          <Button
            size="sm"
            variant="quiet"
            disabled={busy}
            onClick={async () => {
              const go = await confirm({
                title: '이 글을 삭제할까요?',
                body: comments.some((c) => !c.deletedAt) ? '댓글이 있어 ‘삭제된 글’로 남고, 제목과 본문은 지워져요.' : '삭제하면 되돌릴 수 없어요.',
                stayLabel: '그대로 두기',
                goLabel: '삭제하기',
              });
              if (!go) return;
              const out = await execute((d) => deleteCommunityPost(d, user.id, post.id, new Date().toISOString()), () => '글을 삭제했어요.');
              if (out.status === 'saved' && !out.value.soft) await navigate({ screen: board, crewId: post.crewId } as Route);
            }}
          >
            삭제
          </Button>
          {locked && <span className={ps.muted}>답변이 달린 질문은 고칠 수 없어요.</span>}
        </div>
      )}
      <Comments post={post} comments={comments} board={board} canComment={!isAdminView} />
    </article>
  );
}

function Comments({ post, comments, board, canComment }: { post: CommunityPost; comments: CommunityComment[]; board: Board; canComment: boolean }) {
  const { data, user } = useStore();
  return (
    <section className={ps.section} aria-labelledby="comments-title">
      <h2 className={ps.sectionTitle} id="comments-title">
        {board === 'qna' ? '답변·댓글' : '댓글'} <span className="num">{comments.filter((c) => !c.deletedAt).length}</span>
      </h2>
      {comments.length > 0 && (
        <ol className={styles.comments}>
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} isLeaderAnswer={board === 'qna' && c.authorId === data.crews.find((x) => x.id === post.crewId)?.leaderId} />
          ))}
        </ol>
      )}
      {canComment && <CommentForm key={`${post.id}-${user.id}`} postId={post.id} label={board === 'qna' && user.role === 'leader' ? '답변 쓰기' : '댓글 쓰기'} />}
    </section>
  );
}

function CommentItem({ comment, isLeaderAnswer }: { comment: CommunityComment; isLeaderAnswer: boolean }) {
  const { data, user, execute, busy, confirm } = useStore();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [error, setError] = useState<string | undefined>();
  const a = getUser(data, comment.authorId);
  const mine = comment.authorId === user.id && !comment.deletedAt;
  useDirty(`comment-edit-${comment.id}`, editing && body !== comment.body, '고치던 댓글은 저장되지 않아요.');

  if (comment.deletedAt) {
    return (
      <li className={styles.comment}>
        <p className={ps.muted}>삭제된 댓글이에요.</p>
      </li>
    );
  }
  return (
    <li className={styles.comment} data-answer={isLeaderAnswer || undefined}>
      <p className={styles.commentHead}>
        <MetaParts
          items={[
            <span key="n">
              <strong>{a?.name}</strong>&nbsp;{a && ROLE_LABEL[a.role]}
              {isLeaderAnswer && <span className={styles.answerMark}>크루장 답변</span>}
            </span>,
            <time key="d" dateTime={comment.createdAt}>
              {formatDateOnly(comment.createdAt)}
            </time>,
            <span key="t">{formatTimeOnly(comment.createdAt)}</span>,
            ...(comment.updatedAt ? [<span key="e">수정됨</span>] : []),
          ]}
        />
      </p>
      {editing ? (
        <form
          className={ps.form}
          noValidate
          aria-label="댓글 수정"
          onSubmit={async (e) => {
            e.preventDefault();
            const out = await execute((d) => updateComment(d, user.id, comment.id, body, new Date().toISOString()), () => '댓글을 고쳤어요.');
            if (out.status === 'invalid') setError(out.errors.body);
            else if (out.status === 'saved') setEditing(false);
          }}
        >
          <Field label="댓글 수정" error={error} multiline>
            {(p) => <textarea {...p} rows={3} value={body} onChange={(e) => setBody(e.target.value)} />}
          </Field>
          <div className={ps.actions}>
            <Button type="submit" size="sm" busy={busy}>
              저장
            </Button>
            <Button
              size="sm"
              variant="quiet"
              onClick={() => {
                setBody(comment.body);
                setEditing(false);
              }}
            >
              취소
            </Button>
          </div>
        </form>
      ) : (
        <p className={ps.prose}>{comment.body}</p>
      )}
      {mine && !editing && (
        <div className={styles.commentActions}>
          <button type="button" className={styles.textBtn} disabled={busy} onClick={() => setEditing(true)}>
            수정
          </button>
          <button
            type="button"
            className={styles.textBtn}
            disabled={busy}
            onClick={async () => {
              const go = await confirm({ title: '이 댓글을 삭제할까요?', body: '‘삭제된 댓글’로 남고 내용은 지워져요.', stayLabel: '그대로 두기', goLabel: '삭제하기' });
              if (go) await execute((d) => deleteComment(d, user.id, comment.id, new Date().toISOString()), () => '댓글을 삭제했어요.');
            }}
          >
            삭제
          </button>
        </div>
      )}
    </li>
  );
}

/** 관련 미션 (디자인 6.18). 대상자·담당 크루장만 미션명과 `미션 열기`, 그 외에는 잠금 표시 */
function MissionLink({ post }: { post: CommunityPost }) {
  const { data, user, navigate } = useStore();
  if (user.role === 'admin') return null;
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
  const open = (m: Mission) => void navigate({ screen: 'mission', missionId: m.id });
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

function CommentForm({ postId, label }: { postId: string; label: string }) {
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
      <Field label={label} error={errors.body} multiline>
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
        <Button type="submit" busy={busy}>
          댓글 달기
        </Button>
      </div>
    </form>
  );
}

function PostForm({ board, editing, onCancel }: { board: Board; editing?: CommunityPost; onCancel: () => void }) {
  const { data, user, execute, busy, navigate, setDirty, confirm } = useStore();
  const kinds = kindsFor(user, board);
  const initial: CommunityPostInput = editing
    ? { kind: editing.kind, title: editing.title, body: editing.body, missionId: editing.missionId ?? '', private: !!editing.private }
    : { kind: kinds.length === 1 ? kinds[0] : '', title: '', body: '', missionId: '', private: false };
  const [v, setV] = useState<CommunityPostInput>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const missions = linkableMissions(data, user);
  const dirtyKey = 'community-post-form';
  const dirty = v.title !== initial.title || v.body !== initial.body || v.missionId !== initial.missionId || v.kind !== initial.kind || !!v.private !== !!initial.private;
  useDirty(dirtyKey, dirty, '작성 중인 글은 사라져요.');

  function update(patch: Partial<CommunityPostInput>) {
    const next = { ...v, ...patch };
    setV(next);
    if (Object.keys(errors).length) {
      const fresh = validateCommunityPost(data, user, next, board);
      setErrors((prev) => {
        const out: FieldErrors = {};
        for (const k of Object.keys(prev)) if (fresh[k]) out[k] = fresh[k];
        return out;
      });
    }
  }

  async function save() {
    setSaveFailed(false);
    const now = new Date().toISOString();
    const out = editing
      ? await execute((d) => updateCommunityPost(d, user.id, editing.id, v, now), () => '글을 고쳤어요.')
      : await execute((d) => {
          const errs = validateCommunityPost(d, user, v, board);
          if (Object.keys(errs).length) return { ok: false as const, errors: errs };
          return createCommunityPost(d, user.id, v, now);
        }, () => (board === 'qna' ? '질문을 올렸어요. 크루장이 답하면 알림함에 알려 드려요.' : '글을 올렸어요.'));
    if (out.status === 'invalid') {
      setErrors(out.errors);
      const first = ['kind', 'title', 'body', 'missionId'].find((k) => out.errors[k]);
      if (first) document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
    } else if (out.status === 'save_failed') setSaveFailed(true);
    else if (out.status === 'saved') {
      setDirty(dirtyKey, null);
      await navigate({ screen: board, crewId: user.crewId!, postId: out.value.id } as Route);
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
      <h1 className={ps.detailTitle}>{editing ? '글 수정' : board === 'qna' ? '질문하기' : '글 작성'}</h1>
      {board === 'community' && kinds.length > 1 && (
        <FieldGroup legend="글 구분" error={errors.kind} help="공지는 자유게시판 맨 위와 크루방에 강조돼요.">
          {() => (
            <div className={choiceStyles.choicesRow}>
              {kinds.map((k, i) => (
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
      {errors.kind && kinds.length <= 1 && <ErrorBand>{errors.kind}</ErrorBand>}
      <Field label="제목" error={errors.title}>
        {(p) => <input {...p} data-field="title" name="community-title" value={v.title} onChange={(e) => update({ title: e.target.value })} />}
      </Field>
      <Field label={board === 'qna' ? '질문 내용' : '본문'} error={errors.body} multiline>
        {(p) => <textarea {...p} data-field="body" name="community-body" rows={6} value={v.body} onChange={(e) => update({ body: e.target.value })} />}
      </Field>
      {board === 'qna' && (
        <label className={choiceStyles.choice}>
          <input type="checkbox" name="qna-private" checked={!!v.private} onChange={(e) => update({ private: e.target.checked })} />
          비공개 질문 (나와 크루장·담당 관리자만 볼 수 있어요)
        </label>
      )}
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
          {editing ? '고친 내용 저장' : '올리기'}
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
