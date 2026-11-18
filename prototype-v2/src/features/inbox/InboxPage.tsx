import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { MetaParts } from '../../components/MetaParts/MetaParts';
import { inboxFor } from '../../domain/inbox';
import { formatDateOnly, formatTimeOnly } from '../../domain/time';
import { useStore } from '../../state/AppStore';
import { PageHeader, pageStyles as ps } from '../common/Page';
import styles from './Inbox.module.css';

/**
 * 알림함 (4.5단계, 사용자 결정). 로그인한 모든 역할이 자기 범위의 알림을 본다.
 * 앱 안에서만 보는 알림이고 카카오·이메일로 보내지 않는다. 항목을 누르면 해당 화면으로 간다.
 * 열면 '마지막으로 연 시각'을 저장하고, 이번에 처음 보는 알림에는 '새 알림' 표시를 남긴다.
 */
export function InboxPage() {
  const { data, user, navigate, markInboxSeen } = useStore();
  // 이 화면을 연 순간의 읽음 기준. 열자마자 읽음 처리해도 이번 방문에서는 새 알림 표시를 유지한다
  const [seenBefore] = useState(() => data.readMarks[user.id] ?? null);
  useEffect(() => {
    markInboxSeen();
  }, [markInboxSeen]);
  const items = inboxFor(data, user);

  return (
    <div className={`${ps.screen} ${ps.reading}`}>
      <PageHeader title="알림">
        <span>서비스 안에서만 보는 알림이에요. 카카오톡·이메일로 보내지 않아요.</span>
      </PageHeader>
      {items.length === 0 ? (
        <div className={ps.panel}>
          <EmptyState title="아직 알림이 없어요">새 미션·피드백·제출·글이 생기면 여기에 보여요.</EmptyState>
        </div>
      ) : (
        <ul className={styles.list} aria-label="알림 목록">
          {items.map((it) => {
            const fresh = !seenBefore || it.at > seenBefore;
            return (
              <li key={it.id}>
                <button type="button" className={styles.item} data-fresh={fresh || undefined} onClick={() => void navigate(it.target)}>
                  <span className={styles.kind}>{it.label}</span>
                  <span className={styles.body}>
                    <span className={styles.text}>{it.text}</span>
                    <span className={styles.meta}>
                      <MetaParts
                        items={[
                          <time key="d" dateTime={it.at}>
                            {formatDateOnly(it.at)}
                          </time>,
                          <span key="t">{formatTimeOnly(it.at)}</span>,
                          ...(fresh ? [<span key="n" className={styles.newMark}>새 알림</span>] : []),
                        ]}
                      />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
