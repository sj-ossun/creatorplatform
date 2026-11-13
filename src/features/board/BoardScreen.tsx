import { useState } from 'react';
import { Breadcrumbs } from '../../components/Breadcrumbs/Breadcrumbs';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { choiceStyles, ErrorBand, Field, FieldGroup } from '../../components/Field/Field';
import { FilterTabs } from '../../components/FilterTabs/FilterTabs';
import { HelpTitle } from '../../components/HelpTitle/HelpTitle';
import { ListRow, RowList } from '../../components/ListRow/ListRow';
import { MetaParts } from '../../components/MetaParts/MetaParts';
import { Tag } from '../../components/Tag/Tag';
import { FORM_ERROR, type FieldErrors } from '../../domain/commands';
import {
  addGlobalComment,
  authorLabel,
  BOARD_BODY_MAX,
  BOARD_TITLE_MAX,
  boardComments,
  boardPosts,
  createGlobalPost,
  deleteGlobalComment,
  deleteGlobalPost,
  excerpt,
  hasAgreed,
  hasReported,
  hideTarget,
  reportTarget,
  unhideTarget,
  updateGlobalPost,
} from '../../domain/board';
import { formatList } from '../../domain/time';
import { REPORT_REASON_LABEL, type GlobalPost, type Hidden, type ReportReason } from '../../domain/types';
import { useDirty, useStore } from '../../state/AppStore';
import { COMMUNITY_BOARDS, type Route } from '../../state/routes';
import { pageStyles as ps } from '../common/Page';
import styles from './Board.module.css';

type BoardRoute = Extract<Route, { screen: 'board' }>;
const REASONS = Object.keys(REPORT_REASON_LABEL) as ReportReason[];

/**
 * 전체 크루 게시판 (UI 개선 D, 사용자 확정). 크루원·크루장은 커뮤니티의 넷째 탭으로, 관리자는 상단 메뉴로 들어온다.
 * 목록 → 글 상세·쓰기·고치기는 목록 자리에서 전환한다. 말머리 없이 '질문이에요' 표시만 둔다.
 */
export function BoardScreen() {
  const { data, user, route, navigate } = useStore();
  const r = route as BoardRoute;
  const go = (patch: Partial<BoardRoute> = {}) => void navigate({ screen: 'board', ...patch });
  const posts = boardPosts(data, user, !!r.questionsOnly);
  const selected = r.postId ? data.globalPosts.find((p) => p.id === r.postId && !p.deletedAt) : undefined;

  if (r.writing || (r.editing && selected)) {
    return (
      <div className={`${ps.screen} ${ps.reading}`}>
        <BoardCrumbs current={r.editing ? '글 고치기' : '글쓰기'} />
        <div className={ps.panelPad}>
          <PostForm editing={r.editing ? selected : undefined} onDone={(id) => go(id ? { postId: id } : {})} />
        </div>
      </div>
    );
  }

  if (selected) {
    return (
      <div className={`${ps.screen} ${ps.reading}`}>
        <BoardCrumbs current={selected.title} />
        <div className={ps.actions}>
          <Button size="sm" onClick={() => go()}>
            목록으로
          </Button>
        </div>
        <div className={ps.panelPad}>
          <PostDetail key={selected.id} post={selected} />
        </div>
      </div>
    );
  }

  const crewTabs = (user.role === 'member' || user.role === 'leader') && user.crewId;
  return (
    <div className={`${ps.screen} ${ps.explore}`}>
      <div className={ps.pageHead}>
        <div>
          <HelpTitle
            className={ps.title}
            title={crewTabs ? '커뮤니티' : '전체 크루 게시판'}
            help="모든 크루의 크루원·크루장과 운영팀이 함께 보는 게시판이에요. 크루 안 글(공지·자유게시판·Q&A)은 여기에 섞이지 않아요."
          />
        </div>
        <Button variant="action" onClick={() => go({ writing: true })}>
          글쓰기
        </Button>
      </div>
      {crewTabs && (
        <FilterTabs
          label="커뮤니티 게시판"
          idPrefix="board"
          panelId="board-panel"
          items={[...COMMUNITY_BOARDS.map((b) => ({ key: b.board as string, label: b.label })), { key: 'global', label: '전체 크루 게시판' }]}
          selected="global"
          onSelect={(k) => void navigate(k === 'global' ? { screen: 'board' } : ({ screen: k, crewId: user.crewId! } as Route))}
        />
      )}
      <div role={crewTabs ? 'tabpanel' : undefined} id={crewTabs ? 'board-panel' : undefined} aria-labelledby={crewTabs ? 'board-tab-global' : undefined} className={ps.group}>
        <div className={styles.listBar}>
          <label className={choiceStyles.choice}>
            <input type="checkbox" checked={!!r.questionsOnly} onChange={(e) => go({ questionsOnly: e.target.checked || undefined })} />
            질문만 보기
          </label>
          <Button variant="quiet" size="sm" onClick={() => void navigate({ screen: 'board-policy' })}>
            운영 정책
          </Button>
        </div>
        {posts.length === 0 ? (
          <div className={ps.panel}>
            <EmptyState
              title={r.questionsOnly ? '아직 올라온 질문이 없어요' : '아직 올라온 글이 없어요'}
              action={<Button onClick={() => go({ writing: true })}>글쓰기</Button>}
            >
              다른 크루와 나누고 싶은 팁이나 궁금한 점을 올려 보세요.
            </EmptyState>
          </div>
        ) : (
          <div className={ps.panel}>
            <RowList label="전체 크루 게시판 글 목록">
              {posts.map((p) => {
                const count = data.globalComments.filter((c) => c.postId === p.id && !c.deletedAt && !c.hidden).length;
                return (
                  <ListRow
                    key={p.id}
                    selected={false}
                    onSelect={() => go({ postId: p.id })}
                    leading={p.question ? <span className={styles.qTag}>질문</span> : undefined}
                    indentMeta={false}
                    title={p.title}
                    trailing={p.hidden ? <Tag variant="internal">숨김</Tag> : undefined}
                    meta={
                      <span className={styles.rowMeta}>
                        <span className={styles.excerpt}>{excerpt(p.body)}</span>
                        <MetaParts items={[authorLabel(data, p.authorId), <time key="t" dateTime={p.createdAt}>{formatList(p.createdAt)}</time>, <span key="c">댓글 {count}</span>]} />
                      </span>
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

function BoardCrumbs({ current }: { current: string }) {
  const { navigate } = useStore();
  return <Breadcrumbs items={[{ label: '전체 크루 게시판', onClick: () => void navigate({ screen: 'board' }) }, { label: current }]} />;
}

function PostForm({ editing, onDone }: { editing?: GlobalPost; onDone: (id?: string) => void }) {
  const { data, user, execute, busy, confirm, setDirty } = useStore();
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [question, setQuestion] = useState(editing?.question ?? false);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const needsAgree = !editing && !hasAgreed(data, user.id);
  const dirtyKey = 'board-post';
  const dirty = title !== (editing?.title ?? '') || body !== (editing?.body ?? '') || question !== (editing?.question ?? false);
  useDirty(dirtyKey, dirty, '작성 중인 글은 사라져요.');

  return (
    <form
      className={ps.form}
      noValidate
      aria-label={editing ? '글 고치기' : '전체 크루 게시판 글쓰기'}
      onSubmit={async (e) => {
        e.preventDefault();
        const now = new Date().toISOString();
        const out = await execute(
          (d) => (editing ? updateGlobalPost(d, user.id, editing.id, { title, body, question }, now) : createGlobalPost(d, user.id, { title, body, question, agree }, now)),
          () => (editing ? '글을 고쳤어요.' : '글을 올렸어요. 모든 크루가 볼 수 있어요.'),
        );
        if (out.status === 'invalid') setErrors(out.errors);
        else if (out.status === 'saved') {
          setDirty(dirtyKey, null);
          onDone(out.value.id);
        }
      }}
    >
      <Field label="제목" error={errors.title} help={`${BOARD_TITLE_MAX}자 이내`}>
        {(p) => <input {...p} data-field="title" value={title} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label="본문" error={errors.body} help={`${BOARD_BODY_MAX}자 이내. 목록에는 앞부분만 보여요.`} multiline>
        {(p) => <textarea {...p} data-field="body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />}
      </Field>
      <label className={choiceStyles.choice}>
        <input type="checkbox" checked={question} onChange={(e) => setQuestion(e.target.checked)} />
        질문이에요 <span className={ps.muted}>(목록에 [질문] 표시, ‘질문만 보기’에 나와요)</span>
      </label>
      {needsAgree && (
        <FieldGroup legend="운영 정책 동의" error={errors.agree} help="처음 글을 쓸 때 한 번만 동의해요.">
          {() => (
            <label className={choiceStyles.choice}>
              <input type="checkbox" data-field="agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              전체 크루 게시판 운영 정책을 읽었고 지킬게요
            </label>
          )}
        </FieldGroup>
      )}
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      <div className={ps.actions}>
        <Button type="submit" variant="action" busy={busy}>
          {editing ? '고친 내용 저장' : '올리기'}
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            if (dirty && !(await confirm({ title: '저장하지 않고 나갈까요?', body: '작성 중인 글은 사라져요.', stayLabel: '계속 쓰기', goLabel: '나가기' }))) return;
            setDirty(dirtyKey, null);
            onDone(editing?.id);
          }}
        >
          취소
        </Button>
      </div>
    </form>
  );
}

function HiddenNote({ hidden, mine }: { hidden: Hidden; mine: boolean }) {
  return (
    <p className={styles.hiddenNote} role="note">
      {mine ? '운영 정책에 따라 숨겨진 내 글이에요. 다른 사람에게는 보이지 않아요.' : '운영 정책에 따라 숨긴 글이에요.'} 사유: {REPORT_REASON_LABEL[hidden.reason]}
      {hidden.note ? ` · ${hidden.note}` : ''}
    </p>
  );
}

function PostDetail({ post }: { post: GlobalPost }) {
  const { data, user, execute, busy, confirm, navigate } = useStore();
  const [comment, setComment] = useState('');
  const [cErr, setCErr] = useState<FieldErrors>({});
  const mine = post.authorId === user.id;
  const comments = boardComments(data, user, post.id);
  useDirty(`board-comment-${post.id}`, comment.trim() !== '', '작성 중인 댓글은 사라져요.');

  return (
    <article className={ps.detail} aria-labelledby="board-post-title">
      <div className={ps.detailHead}>
        {post.question && (
          <div className={ps.headRow}>
            <span className={styles.qTag}>질문</span>
          </div>
        )}
        <h1 className={ps.detailTitle} id="board-post-title">
          {post.title}
        </h1>
        <p className={ps.muted}>
          <MetaParts items={[authorLabel(data, post.authorId), <time key="t" dateTime={post.createdAt}>{formatList(post.createdAt)}</time>, ...(post.updatedAt ? [<span key="e">수정됨</span>] : [])]} />
        </p>
      </div>
      {post.hidden && <HiddenNote hidden={post.hidden} mine={mine} />}
      <p className={ps.prose}>{post.body}</p>
      <div className={ps.actions}>
        {mine && !post.hidden && (
          <Button size="sm" disabled={busy} onClick={() => void navigate({ screen: 'board', postId: post.id, editing: true })}>
            수정
          </Button>
        )}
        {mine && (
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              if (!(await confirm({ title: '이 글을 지울까요?', body: '목록과 홈에서 사라져요.', stayLabel: '그대로 두기', goLabel: '지우기' }))) return;
              const out = await execute((d) => deleteGlobalPost(d, user.id, post.id, new Date().toISOString()), () => '글을 지웠어요.');
              if (out.status === 'saved') void navigate({ screen: 'board' });
            }}
          >
            삭제
          </Button>
        )}
        {!mine && !post.hidden && user.role !== 'admin' && <ReportControl type="post" id={post.id} />}
        {user.role === 'admin' && <AdminHide type="post" id={post.id} hidden={post.hidden} />}
      </div>

      <section className={ps.section} aria-labelledby="board-comments-title">
        <h2 className={ps.sectionTitle} id="board-comments-title">
          댓글 {comments.filter((c) => !c.deletedAt && !c.hidden).length}
        </h2>
        {comments.length > 0 && (
          <ul className={styles.comments} aria-label="댓글">
            {comments.map((c) => (
              <li key={c.id} className={styles.comment}>
                {c.deletedAt ? (
                  <p className={ps.muted}>삭제된 댓글이에요.</p>
                ) : (
                  <>
                    <p className={styles.commentHead}>
                      <b>{authorLabel(data, c.authorId)}</b> <time dateTime={c.createdAt}>{formatList(c.createdAt)}</time>
                    </p>
                    {c.hidden && <HiddenNote hidden={c.hidden} mine={c.authorId === user.id} />}
                    <p className={ps.prose}>{c.body}</p>
                    <div className={styles.commentActions}>
                      {c.authorId === user.id && (
                        <Button
                          size="sm"
                          variant="quiet"
                          disabled={busy}
                          onClick={async () => {
                            if (!(await confirm({ title: '댓글을 지울까요?', body: '‘삭제된 댓글’로 남아요.', stayLabel: '그대로 두기', goLabel: '지우기' }))) return;
                            await execute((d) => deleteGlobalComment(d, user.id, c.id, new Date().toISOString()), () => '댓글을 지웠어요.');
                          }}
                        >
                          삭제
                        </Button>
                      )}
                      {c.authorId !== user.id && !c.hidden && user.role !== 'admin' && <ReportControl type="comment" id={c.id} />}
                      {user.role === 'admin' && <AdminHide type="comment" id={c.id} hidden={c.hidden} />}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {!post.hidden && (
          <form
            className={ps.form}
            noValidate
            aria-label="댓글 달기"
            onSubmit={async (e) => {
              e.preventDefault();
              const out = await execute((d) => addGlobalComment(d, user.id, post.id, comment, new Date().toISOString()), () => '댓글을 달았어요.');
              if (out.status === 'invalid') setCErr(out.errors);
              else if (out.status === 'saved') {
                setComment('');
                setCErr({});
              }
            }}
          >
            <Field label="댓글 쓰기" error={cErr.body} multiline>
              {(p) => <textarea {...p} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />}
            </Field>
            <div>
              <Button type="submit" busy={busy}>
                댓글 달기
              </Button>
            </div>
          </form>
        )}
      </section>
    </article>
  );
}

/** 신고하기: 사유를 고르고 보낸다. 크루장도 신고만 한다 (숨김은 관리자) */
function ReportControl({ type, id }: { type: 'post' | 'comment'; id: string }) {
  const { data, user, execute, busy } = useStore();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const what = type === 'post' ? '글' : '댓글';
  if (hasReported(data, user.id, type, id)) return <span className={ps.muted}>신고했어요</span>;
  if (!open) {
    return (
      <Button size="sm" variant="quiet" onClick={() => setOpen(true)} aria-label={`이 ${what} 신고하기`}>
        신고하기
      </Button>
    );
  }
  return (
    <form
      className={styles.reportForm}
      noValidate
      aria-label={`${what} 신고`}
      onSubmit={async (e) => {
        e.preventDefault();
        const out = await execute((d) => reportTarget(d, user.id, type, id, reason, note, new Date().toISOString()), () => '신고했어요. 운영팀이 확인해요.');
        if (out.status === 'invalid') setErrors(out.errors);
        else if (out.status === 'saved') setOpen(false);
      }}
    >
      <FieldGroup legend="신고 사유" error={errors.reason}>
        {() => (
          <div className={choiceStyles.choicesRow}>
            {REASONS.map((k) => (
              <label key={k} className={choiceStyles.choice}>
                <input type="radio" name={`report-${id}`} checked={reason === k} onChange={() => setReason(k)} />
                {REPORT_REASON_LABEL[k]}
              </label>
            ))}
          </div>
        )}
      </FieldGroup>
      <Field label="자세한 내용" optional={reason !== 'other'} error={errors.note}>
        {(p) => <input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      <div className={ps.actions}>
        <Button type="submit" variant="strong" size="sm" busy={busy}>
          신고 보내기
        </Button>
        <Button size="sm" disabled={busy} onClick={() => setOpen(false)}>
          취소
        </Button>
      </div>
    </form>
  );
}

/** 관리자 숨김·숨김 해제 (작성자에게 사유 알림) */
export function AdminHide({ type, id, hidden }: { type: 'post' | 'comment'; id: string; hidden?: Hidden }) {
  const { user, execute, busy } = useStore();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const what = type === 'post' ? '글' : '댓글';
  if (hidden) {
    return (
      <Button size="sm" disabled={busy} onClick={() => void execute((d) => unhideTarget(d, user.id, type, id), () => '숨김을 풀었어요.')} aria-label={`이 ${what} 숨김 풀기`}>
        숨김 풀기
      </Button>
    );
  }
  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} aria-label={`이 ${what} 숨기기`}>
        숨기기
      </Button>
    );
  }
  return (
    <form
      className={styles.reportForm}
      noValidate
      aria-label={`${what} 숨기기`}
      onSubmit={async (e) => {
        e.preventDefault();
        const out = await execute((d) => hideTarget(d, user.id, type, id, reason, note, new Date().toISOString()), () => '숨겼어요. 작성자에게 사유가 알림으로 가요.');
        if (out.status === 'invalid') setErrors(out.errors);
        else if (out.status === 'saved') setOpen(false);
      }}
    >
      <FieldGroup legend="숨기는 사유" error={errors.reason} help="작성자 알림함에 사유가 가요.">
        {() => (
          <div className={choiceStyles.choicesRow}>
            {REASONS.map((k) => (
              <label key={k} className={choiceStyles.choice}>
                <input type="radio" name={`hide-${id}`} checked={reason === k} onChange={() => setReason(k)} />
                {REPORT_REASON_LABEL[k]}
              </label>
            ))}
          </div>
        )}
      </FieldGroup>
      <Field label="작성자에게 남길 말" optional>
        {(p) => <input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      <div className={ps.actions}>
        <Button type="submit" variant="strong" size="sm" busy={busy}>
          숨기기
        </Button>
        <Button size="sm" disabled={busy} onClick={() => setOpen(false)}>
          취소
        </Button>
      </div>
    </form>
  );
}
