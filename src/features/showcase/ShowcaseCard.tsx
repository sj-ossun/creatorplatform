import { ExternalLink } from '../../components/VersionTimeline/VersionTimeline';
import { Tag } from '../../components/Tag/Tag';
import { crewProfile } from '../../domain/crewProfile';
import type { ShowcaseView } from '../../domain/showcase';
import { formatCount, formatDay } from '../../domain/time';
import { ROLE_LABEL } from '../../domain/types';
import styles from './Showcase.module.css';

/** 우수 사례 한 건 (크루 로그인 후): 크리에이터·크루·미션, 성과 한 줄, 실제 게시 URL, 최신 조회수·확인일, 학습 포인트 */
export function ShowcaseCard({ view }: { view: ShowcaseView }) {
  const { category } = crewProfile(view.crew);
  const m = view.metric;
  return (
    <article className={styles.card} aria-label={`${view.creator.name} 우수 사례`}>
      <div className={styles.cardHead}>
        {category && <span className={styles.category}>{category}</span>}
        <span className={styles.crew}>{view.crew.name} 크루</span>
        <Tag variant="sim">시연용 가상 사례</Tag>
      </div>
      <h3 className={styles.title}>{view.mission.title}</h3>
      <p className={styles.creator}>{view.creator.name} 크리에이터</p>
      {view.showcase.headline && <p className={styles.headline}>{view.showcase.headline}</p>}
      <blockquote className={styles.quote}>
        <p>
          <span className={styles.lpLabel}>학습 포인트</span> {view.showcase.comment}
        </p>
        <footer>
          {view.author.name} {ROLE_LABEL[view.author.role]}이 골랐어요
        </footer>
      </blockquote>
      <dl className={styles.facts}>
        <div>
          <dt>조회수</dt>
          <dd>
            {m.kind === 'views' ? (
              <>
                <span className="num">{formatCount(m.latest.views!)}</span>회
                <span className={styles.small}> · 확인일 {formatDay(m.latest.checkedOn)}, 직접 입력</span>
              </>
            ) : (
              '미집계'
            )}
          </dd>
        </div>
        <div>
          <dt>결과물</dt>
          <dd>
            <ExternalLink href={view.post.url} /> <span className={styles.small}>({view.post.platform})</span>
          </dd>
        </div>
      </dl>
    </article>
  );
}
