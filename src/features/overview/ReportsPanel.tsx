import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { authorLabel, dismissReports, hiddenItems, reportQueue } from '../../domain/board';
import { formatList } from '../../domain/time';
import { REPORT_REASON_LABEL } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import { AdminHide } from '../board/BoardScreen';
import { pageStyles as ps } from '../common/Page';
import styles from './Overview.module.css';

/**
 * 운영 관리 › 신고 (UI 개선 D): 전체 크루 게시판에 들어온 신고를 대상별로 묶어 보여준다.
 * 숨기기(작성자에게 사유 알림) 또는 신고 무시. 아래에 숨긴 항목과 숨김 풀기.
 */
export function ReportsPanel() {
  const { data, user, execute, busy, navigate } = useStore();
  const queue = reportQueue(data);
  const hidden = hiddenItems(data);
  return (
    <div className={ps.screen}>
      <section className={ps.group} aria-labelledby="report-queue-title">
        <h2 className={ps.sectionTitle} id="report-queue-title">
          처리할 신고 {queue.length}건
        </h2>
        {queue.length === 0 ? (
          <div className={ps.panel}>
            <EmptyState title="처리할 신고가 없어요" />
          </div>
        ) : (
          <ul className={styles.noticeList} aria-label="신고 목록">
            {queue.map((g) => {
              const reasons = [...new Set(g.reports.map((r) => REPORT_REASON_LABEL[r.reason]))].join(' · ');
              return (
                <li key={`${g.type}-${g.id}`} className={styles.noticeRow}>
                  <div className={styles.noticeMain}>
                    <p className={styles.noticeTitle}>
                      {g.type === 'post' ? '글' : '댓글'} · {g.label}
                    </p>
                    <p>
                      신고 {g.reports.length}건 · {reasons}
                    </p>
                    {g.reports.some((r) => r.note) && <p className={ps.muted}>{g.reports.filter((r) => r.note).map((r) => `“${r.note}”`).join(' ')}</p>}
                    <p className={ps.muted}>
                      작성 {authorLabel(data, g.authorId)} · 최근 신고 <time dateTime={g.latestAt}>{formatList(g.latestAt)}</time>
                    </p>
                    <div className={ps.actions}>
                      <Button size="sm" onClick={() => void navigate({ screen: 'board', postId: g.postId })}>
                        {g.type === 'post' ? '글 보기' : '댓글 달린 글 보기'}
                      </Button>
                      <AdminHide type={g.type} id={g.id} />
                      <Button
                        size="sm"
                        variant="quiet"
                        disabled={busy}
                        onClick={() => void execute((d) => dismissReports(d, user.id, g.type, g.id, new Date().toISOString()), () => '신고를 무시하고 정리했어요.')}
                      >
                        신고 무시
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {hidden.length > 0 && (
        <section className={ps.group} aria-labelledby="hidden-title">
          <h2 className={ps.sectionTitle} id="hidden-title">
            숨긴 항목
          </h2>
          <ul className={styles.noticeList} aria-label="숨긴 항목">
            {hidden.map((h) => (
              <li key={`${h.type}-${h.id}`} className={styles.noticeRow}>
                <div className={styles.noticeMain}>
                  <p className={styles.noticeTitle}>
                    {h.type === 'post' ? '글' : '댓글'} · {h.label}
                  </p>
                  <p className={ps.muted}>
                    {REPORT_REASON_LABEL[h.hidden.reason]}
                    {h.hidden.note ? ` · ${h.hidden.note}` : ''} · <time dateTime={h.hidden.at}>{formatList(h.hidden.at)}</time>
                  </p>
                </div>
                <AdminHide type={h.type} id={h.id} hidden={h.hidden} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
