import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { observationsOf, postOf } from '../../domain/performance';
import { deliverableOf, getMission } from '../../domain/queries';
import { formatCount, formatDay } from '../../domain/time';
import { useStore } from '../../state/AppStore';
import { MissionCrumbs } from '../common/MissionCrumbs';
import { pageStyles as ps } from '../common/Page';
import { ExternalLink } from '../../components/VersionTimeline/VersionTimeline';
import { ObservationForm, PostForm } from './PostSection';

/**
 * P-07 게시·성과 기록 (v0.6 02 12장, F-07). 본인의 검토 완료 결과물에서만 연다.
 * 게시 정보(플랫폼·게시 URL·게시일)와 성과·회고(확인일·조회수·회고)를 나눠 저장한다.
 * 게시 기록은 선택이고, 저장해도 완료 상태는 바뀌지 않는다. 게시 정보 없이 성과 기록을 만들지 않는다.
 */
export function RecordPage({ missionId }: { missionId: string }) {
  const { data, user, navigate } = useStore();
  const [editingPost, setEditingPost] = useState(false);
  const [obsKey, setObsKey] = useState(0);
  const mission = getMission(data, missionId);
  const deliverable = mission && deliverableOf(data, mission.id, user.id);
  if (!mission || !deliverable) return null;
  const post = postOf(data, deliverable.id);
  const observations = post ? observationsOf(data, post.id) : [];
  const back = () => void navigate({ screen: 'mission', missionId: mission.id });

  return (
    <div className={`${ps.screen} ${ps.reading}`}>
      <MissionCrumbs mission={mission} inRecord />
      <div className={ps.pageHead}>
        <div>
          <h1 className={ps.title}>게시·성과 기록</h1>
          <p className={ps.muted}>
            {mission.title} · 완료 결과물 · 게시 기록은 선택이에요. 남기지 않아도 완료 상태는 그대로예요.
          </p>
        </div>
        <Button size="sm" onClick={back}>
          미션 상세로 돌아가기
        </Button>
      </div>

      <section className={`${ps.panelPad} ${ps.section}`} aria-labelledby="post-info-title">
        <h2 className={ps.sectionTitle} id="post-info-title">
          게시 정보
        </h2>
        {post && !editingPost ? (
          <>
            <dl className={ps.kv}>
              <div>
                <dt>플랫폼</dt>
                <dd>{post.platform}</dd>
              </div>
              <div>
                <dt>게시 URL</dt>
                <dd>
                  <ExternalLink href={post.url} />
                </dd>
              </div>
              <div>
                <dt>게시일</dt>
                <dd>{formatDay(post.publishedOn)}</dd>
              </div>
            </dl>
            <div className={ps.actions}>
              <Button onClick={() => setEditingPost(true)}>게시 정보 고치기</Button>
            </div>
          </>
        ) : (
          <PostForm
            deliverable={deliverable}
            onClose={() => (post ? setEditingPost(false) : back())}
            onSaved={() => setEditingPost(false)}
            cancelLabel={post ? '취소' : '미션 상세로'}
          />
        )}
      </section>

      <section className={`${ps.panelPad} ${ps.section}`} aria-labelledby="perf-title">
        <h2 className={ps.sectionTitle} id="perf-title">
          성과·회고
        </h2>
        {!post ? (
          <p className={ps.muted}>게시 정보를 먼저 저장하면 확인일별 조회수와 회고를 남길 수 있어요.</p>
        ) : (
          <ObservationForm key={obsKey} deliverable={deliverable} onSaved={() => setObsKey((k) => k + 1)} />
        )}
      </section>

      {post && (
        <section className={ps.section} aria-labelledby="obs-history-title">
          <h2 className={ps.sectionTitle} id="obs-history-title">
            과거 확인일별 기록
          </h2>
          {observations.length === 0 ? (
            <p className={ps.muted}>아직 성과 기록이 없어요. 조회수는 지금 ‘미집계’예요.</p>
          ) : (
            <div className={ps.tableWrap}>
              <table className={ps.simpleTable} aria-label="확인일별 성과 기록">
                <thead>
                  <tr>
                    <th scope="col">확인일</th>
                    <th scope="col" className={ps.numCol}>
                      조회수
                    </th>
                    <th scope="col">회고</th>
                    <th scope="col">입력 출처</th>
                  </tr>
                </thead>
                <tbody>
                  {observations.map((o) => (
                    <tr key={o.id}>
                      <td>{formatDay(o.checkedOn)}</td>
                      <td className={`${ps.numCol} num`}>{o.views === null ? '미집계' : `${formatCount(o.views)}회`}</td>
                      <td>{o.retrospective || '없음'}</td>
                      <td>수동</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
