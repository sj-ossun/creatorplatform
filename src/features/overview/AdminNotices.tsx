import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { choiceStyles, ErrorBand, Field, FieldGroup } from '../../components/Field/Field';
import { FORM_ERROR, type FieldErrors } from '../../domain/commands';
import { ADMIN_NOTICE_BODY_MAX, ADMIN_NOTICE_TITLE_MAX, adminNoticesFor, createAdminNotice, deleteAdminNotice } from '../../domain/adminNotices';
import { getCrew } from '../../domain/queries';
import { formatList } from '../../domain/time';
import { useDirty, useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';
import styles from './Overview.module.css';

/**
 * 운영 관리 › 공지 (6-C, 테스터 피드백 '관리자 공지'). 담당 크루를 골라 올리면 그 크루의 크루방 공지 카드와
 * 구성원 알림함에 '운영 공지'로 보인다. 앱 안에서만 보이고 외부로 보내지 않는다.
 */
export function AdminNotices() {
  const { data, user, execute, busy, confirm } = useStore();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [crewIds, setCrewIds] = useState<string[]>(user.managedCrewIds);
  const [errors, setErrors] = useState<FieldErrors>({});
  useDirty('admin-notice', title.trim() !== '' || body.trim() !== '', '작성 중인 운영 공지는 사라져요.');
  const notices = adminNoticesFor(data, user.id);
  const toggle = (id: string) => setCrewIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <div className={ps.screen}>
      <form
        className={ps.panelPad}
        noValidate
        aria-label="운영 공지 쓰기"
        onSubmit={async (e) => {
          e.preventDefault();
          const out = await execute((d) => createAdminNotice(d, user.id, { title, body, crewIds }, new Date().toISOString()), () => '운영 공지를 올렸어요. 고른 크루의 크루방과 알림함에 보여요.');
          if (out.status === 'invalid') setErrors(out.errors);
          else if (out.status === 'saved') {
            setTitle('');
            setBody('');
            setErrors({});
          }
        }}
      >
        <h2 className={ps.sectionTitle}>운영 공지 쓰기</h2>
        <Field label="제목" error={errors.title} help={`${ADMIN_NOTICE_TITLE_MAX}자 이내`}>
          {(p) => <input {...p} name="admin-notice-title" data-field="title" value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="내용" error={errors.body} help={`${ADMIN_NOTICE_BODY_MAX}자 이내. 크루방에서 바로 읽혀요.`} multiline>
          {(p) => <textarea {...p} name="admin-notice-body" data-field="body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />}
        </Field>
        <FieldGroup legend="보여줄 크루" error={errors.crewIds} help="담당 크루 중에서 골라요.">
          {() => (
            <div className={choiceStyles.choicesRow}>
              {user.managedCrewIds.map((id, i) => (
                <label key={id} className={choiceStyles.choice}>
                  <input type="checkbox" data-field={i === 0 ? 'crewIds' : undefined} checked={crewIds.includes(id)} onChange={() => toggle(id)} />
                  {getCrew(data, id)?.name} 크루
                </label>
              ))}
            </div>
          )}
        </FieldGroup>
        {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
        <div>
          <Button type="submit" variant="action" busy={busy}>
            공지 올리기
          </Button>
        </div>
      </form>

      <section className={ps.group} aria-labelledby="admin-notices-title">
        <h2 className={ps.sectionTitle} id="admin-notices-title">
          올린 운영 공지
        </h2>
        {notices.length === 0 ? (
          <div className={ps.panel}>
            <EmptyState title="아직 올린 운영 공지가 없어요" />
          </div>
        ) : (
          <ul className={styles.noticeList} aria-label="운영 공지 목록">
            {notices.map((n) => (
              <li key={n.id} className={styles.noticeRow}>
                <div className={styles.noticeMain}>
                  <p className={styles.noticeTitle}>{n.title}</p>
                  <p>{n.body}</p>
                  <p className={ps.muted}>
                    {n.crewIds.map((id) => `${getCrew(data, id)?.name} 크루`).join(' · ')} · <time dateTime={n.createdAt}>{formatList(n.createdAt)}</time>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="quiet"
                  disabled={busy}
                  aria-label={`${n.title} 지우기`}
                  onClick={async () => {
                    const go = await confirm({ title: '운영 공지를 지울까요?', body: '크루방과 알림함에서 내려가요.', stayLabel: '그대로 두기', goLabel: '지우기' });
                    if (go) await execute((d) => deleteAdminNotice(d, user.id, n.id, new Date().toISOString()), () => '운영 공지를 지웠어요.');
                  }}
                >
                  지우기
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
