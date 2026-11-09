import { useState } from 'react';
import { feedbacksForVersion, getUser, versionsOf } from '../../domain/queries';
import { formatDetail } from '../../domain/time';
import type { AppData, Deliverable, ID, SubmissionFormat } from '../../domain/types';
import { Icon } from '../Icon/Icon';
import { StatusChip } from '../StatusChip/StatusChip';
import { Tag } from '../Tag/Tag';
import styles from './VersionTimeline.module.css';

interface Props {
  data: AppData;
  deliverable: Deliverable;
  format: SubmissionFormat;
  /** 알림에서 연 피드백. 해당 버전 상자를 표시한다 */
  highlightFeedbackId?: ID;
}

export function ExternalLink({ href }: { href: string }) {
  return (
    <a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">
      {href}
      <Icon name="external" />
      <span className="sr-only">(새 탭에서 열림)</span>
    </a>
  );
}

/** 버전 기록 (디자인 6.9). 최신이 맨 위, 피드백은 해당 버전 바로 아래. */
export function VersionTimeline({ data, deliverable, format, highlightFeedbackId }: Props) {
  const versions = versionsOf(data, deliverable.id);
  const [showAll, setShowAll] = useState(false);
  const highlightVersionId = highlightFeedbackId
    ? data.feedbacks.find((f) => f.id === highlightFeedbackId)?.versionId
    : undefined;
  const hiddenCount = versions.length > 2 ? versions.length - 2 : 0;
  const visible = showAll || hiddenCount === 0
    ? versions
    : versions.filter((v, i) => i < 2 || v.id === highlightVersionId);

  return (
    <div className={styles.wrap}>
      <ol className={styles.versions} aria-label="제출 기록">
        {visible.map((v, index) => {
          const latest = index === 0;
          const feedbacks = feedbacksForVersion(data, v.id);
          return (
            <li key={v.id} className={styles.version} data-latest={latest || undefined}>
              <span className={styles.dot} aria-hidden="true" />
              <div className={styles.vhead}>
                <h3 className={styles.vtitle}>{v.number}차 제출</h3>
                <time dateTime={v.submittedAt} className={styles.time}>
                  {formatDetail(v.submittedAt)}
                </time>
                {v.late && <Tag>기한 후 제출</Tag>}
                {latest && <span className="sr-only">(최신)</span>}
              </div>
              <dl className={styles.box} data-highlight={v.id === highlightVersionId || undefined}>
                <div>
                  <dt>{format === 'link' ? '영상 링크' : '제출 내용'}</dt>
                  <dd className={format === 'text' ? styles.prose : undefined}>
                    {format === 'link' ? <ExternalLink href={v.content} /> : v.content}
                  </dd>
                </div>
                {v.changeNote && (
                  <div>
                    <dt>수정한 내용</dt>
                    <dd className={styles.prose}>{v.changeNote}</dd>
                  </div>
                )}
                {v.description && (
                  <div>
                    <dt>설명</dt>
                    <dd className={styles.prose}>{v.description}</dd>
                  </div>
                )}
              </dl>
              {feedbacks.map((f) => (
                <section
                  key={f.id}
                  className={styles.feedback}
                  data-result={f.result}
                  aria-label={`${v.number}차 제출 피드백`}
                  data-highlight={f.id === highlightFeedbackId || undefined}
                >
                  <div className={styles.fhead}>
                    <span className={styles.author}>{getUser(data, f.authorId)?.name} 크루장</span>
                    <StatusChip status={f.result} />
                    <time dateTime={f.createdAt} className={styles.time}>
                      {formatDetail(f.createdAt)}
                    </time>
                  </div>
                  {f.comment ? (
                    <p className={styles.prose}>{f.comment}</p>
                  ) : (
                    <p className={styles.muted}>남긴 설명이 없어요.</p>
                  )}
                </section>
              ))}
            </li>
          );
        })}
      </ol>
      {hiddenCount > 0 && (
        <button type="button" className={styles.more} onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}>
          {showAll ? '이전 버전 접기' : `이전 버전 보기 (${hiddenCount}개)`}
        </button>
      )}
    </div>
  );
}
