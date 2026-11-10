import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { ErrorBand, Field, FieldGroup } from '../../components/Field/Field';
import { SAVE_FAILED } from '../../components/FeedbackComposer/FeedbackComposer';
import { MetricValue } from '../../components/MetricValue/MetricValue';
import { ExternalLink } from '../../components/VersionTimeline/VersionTimeline';
import { FORM_ERROR, type FieldErrors } from '../../domain/commands';
import {
  metricOf,
  observationsOf,
  PLATFORMS,
  postOf,
  saveObservation,
  savePost,
  validateObservation,
  validatePost,
  type ObservationInput,
  type PostInput,
} from '../../domain/performance';
import { formatDay, todayKst } from '../../domain/time';
import type { Deliverable, Mission } from '../../domain/types';
import { useDirty, useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';

export type PostFormMode = 'none' | 'post' | 'observation';

/** 오류가 해소된 입력만 안내를 지운다 */
function keepUnresolved(prev: FieldErrors, fresh: FieldErrors): FieldErrors {
  const out: FieldErrors = {};
  for (const k of Object.keys(prev)) if (fresh[k]) out[k] = fresh[k];
  return out;
}

function focusFirst(errors: FieldErrors, order: string[]) {
  const first = order.find((k) => errors[k]);
  if (first) document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
}

/**
 * SC-04 게시·성과 기록 (F-07). 완료된 결과물에서만 진입한다.
 * 게시·성과 기록은 선택 작업이다: 남기지 않아도 완료 상태는 그대로다.
 */
export function PostSection({
  mission,
  deliverable,
  mode,
  setMode,
}: {
  mission: Mission;
  deliverable: Deliverable;
  mode: PostFormMode;
  setMode: (m: PostFormMode) => void;
}) {
  const { data } = useStore();
  const post = postOf(data, deliverable.id);

  if (!post) {
    return mode === 'post' ? (
      <PostForm deliverable={deliverable} withObservation onClose={() => setMode('none')} />
    ) : null;
  }

  return (
    <section className={ps.section} aria-labelledby="post-title">
      <h3 className={ps.sectionTitle} id="post-title">
        게시·성과 기록
      </h3>
      <div className={ps.criteria}>
        <MetricValue
          data={data}
          title={mission.title}
          metric={metricOf(data, deliverable.id)}
          extra={
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
          }
        />
      </div>
      {mode === 'observation' && <ObservationForm deliverable={deliverable} onClose={() => setMode('none')} />}
      {mode === 'post' && <PostForm deliverable={deliverable} onClose={() => setMode('none')} />}
      {mode === 'none' && (
        <div className={ps.actions}>
          <Button onClick={() => setMode('observation')}>성과 기록 남기기</Button>
          <Button variant="quiet" onClick={() => setMode('post')}>
            게시 정보 고치기
          </Button>
        </div>
      )}
    </section>
  );
}

const EMPTY_OBS: ObservationInput = { checkedOn: '', views: '', retrospective: '' };

function ObservationFields({
  values,
  errors,
  onChange,
  idPrefix,
}: {
  values: ObservationInput;
  errors: FieldErrors;
  onChange: (patch: Partial<ObservationInput>) => void;
  idPrefix: string;
}) {
  return (
    <>
      <Field label="확인일" optional error={errors.checkedOn} help="조회수를 직접 확인한 날이에요. 한국 시간 기준이에요.">
        {(p) => (
          <input
            {...p}
            data-field="checkedOn"
            name={`${idPrefix}-checkedOn`}
            type="date"
            value={values.checkedOn}
            onChange={(e) => onChange({ checkedOn: e.target.value })}
          />
        )}
      </Field>
      <Field label="조회수" optional error={errors.views} help="비워 두면 미집계로 남아요. 실제 0회는 0을 입력하세요.">
        {(p) => (
          <input
            {...p}
            data-field="views"
            name={`${idPrefix}-views`}
            inputMode="numeric"
            autoComplete="off"
            value={values.views}
            onChange={(e) => onChange({ views: e.target.value })}
          />
        )}
      </Field>
      <Field label="회고" optional multiline>
        {(p) => (
          <textarea
            {...p}
            name={`${idPrefix}-retro`}
            rows={3}
            value={values.retrospective}
            onChange={(e) => onChange({ retrospective: e.target.value })}
          />
        )}
      </Field>
    </>
  );
}

function PostForm({
  deliverable,
  withObservation = false,
  onClose,
}: {
  deliverable: Deliverable;
  withObservation?: boolean;
  onClose: () => void;
}) {
  const { data, user, execute, busy, setDirty } = useStore();
  const existing = postOf(data, deliverable.id);
  const initial: PostInput = existing
    ? { platform: existing.platform, url: existing.url, publishedOn: existing.publishedOn }
    : { platform: '', url: '', publishedOn: '' };
  const [post, setPost] = useState<PostInput>(initial);
  const [obs, setObs] = useState<ObservationInput>(EMPTY_OBS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const dirtyKey = `post-${deliverable.id}`;
  const dirty =
    post.platform !== initial.platform ||
    post.url !== initial.url ||
    post.publishedOn !== initial.publishedOn ||
    obs.checkedOn !== '' ||
    obs.views !== '' ||
    obs.retrospective !== '';
  useDirty(dirtyKey, dirty, '작성 중인 게시 기록은 사라져요.');

  function revalidate(nextPost: PostInput, nextObs: ObservationInput) {
    if (!Object.keys(errors).length) return;
    const fresh = { ...validatePost(data, deliverable.id, nextPost, existing), ...validateObservation(nextObs, nextPost.publishedOn, false) };
    setErrors((prev) => keepUnresolved(prev, fresh));
  }
  const updatePost = (patch: Partial<PostInput>) => {
    const next = { ...post, ...patch };
    setPost(next);
    revalidate(next, obs);
  };
  const updateObs = (patch: Partial<ObservationInput>) => {
    const next = { ...obs, ...patch };
    setObs(next);
    revalidate(post, next);
  };

  async function save() {
    setSaveFailed(false);
    const out = await execute(
      (d) => savePost(d, user.id, deliverable.id, post, withObservation ? obs : EMPTY_OBS, new Date().toISOString()),
      () => '게시 기록을 저장했어요.',
    );
    if (out.status === 'invalid') {
      setErrors(out.errors);
      focusFirst(out.errors, ['platform', 'url', 'publishedOn', 'checkedOn', 'views']);
    } else if (out.status === 'save_failed') setSaveFailed(true);
    else if (out.status === 'saved') {
      setDirty(dirtyKey, null);
      onClose();
    }
  }

  return (
    <form
      className={ps.form}
      noValidate
      aria-label="게시 기록"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h3 className={ps.sectionTitle}>{existing ? '게시 정보 고치기' : '게시 기록 남기기'}</h3>
      <Field label="플랫폼" error={errors.platform}>
        {(p) => (
          <select
            {...p}
            data-field="platform"
            name="platform"
            value={post.platform}
            onChange={(e) => updatePost({ platform: e.target.value })}
          >
            <option value="">고르세요</option>
            {PLATFORMS.map((pl) => (
              <option key={pl} value={pl}>
                {pl}
              </option>
            ))}
          </select>
        )}
      </Field>
      <p className={ps.info}>검토용 공유 링크가 아니라 실제 게시물 주소를 넣어 주세요.</p>
      <Field label="게시 URL" error={errors.url}>
        {(p) => (
          <input
            {...p}
            data-field="url"
            name="post-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://"
            value={post.url}
            onChange={(e) => updatePost({ url: e.target.value })}
          />
        )}
      </Field>
      <Field label="게시일" error={errors.publishedOn} help="한국 시간 기준이에요.">
        {(p) => (
          <input
            {...p}
            data-field="publishedOn"
            name="publishedOn"
            type="date"
            value={post.publishedOn}
            onChange={(e) => updatePost({ publishedOn: e.target.value })}
          />
        )}
      </Field>
      {withObservation && (
        <FieldGroup legend="성과 (선택)" help="조회수나 회고를 남기면 확인일이 필요해요. 모두 비우면 게시 정보만 저장해요.">
          {() => (
            <div className={ps.form}>
              <ObservationFields values={obs} errors={errors} onChange={updateObs} idPrefix="first" />
            </div>
          )}
        </FieldGroup>
      )}
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      {saveFailed && <ErrorBand>{SAVE_FAILED}</ErrorBand>}
      <div className={ps.actions}>
        <Button type="submit" variant="action" busy={busy}>
          게시 기록 저장
        </Button>
        <CancelButton dirty={dirty} dirtyKey={dirtyKey} onClose={onClose} body="작성 중인 게시 기록은 사라져요." />
      </div>
    </form>
  );
}

function ObservationForm({ deliverable, onClose }: { deliverable: Deliverable; onClose: () => void }) {
  const { data, user, execute, busy, setDirty } = useStore();
  const post = postOf(data, deliverable.id)!;
  const [obs, setObs] = useState<ObservationInput>({ ...EMPTY_OBS, checkedOn: todayKst() });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const dirtyKey = `observation-${deliverable.id}`;
  const dirty = obs.views !== '' || obs.retrospective !== '';
  useDirty(dirtyKey, dirty, '작성 중인 성과 기록은 사라져요.');
  const sameDay = observationsOf(data, post.id).find((o) => o.checkedOn === obs.checkedOn);

  function update(patch: Partial<ObservationInput>) {
    const next = { ...obs, ...patch };
    setObs(next);
    if (Object.keys(errors).length) setErrors((prev) => keepUnresolved(prev, validateObservation(next, post.publishedOn, true)));
  }

  async function save() {
    setSaveFailed(false);
    const out = await execute(
      (d) => saveObservation(d, user.id, deliverable.id, obs, new Date().toISOString()),
      () => '성과 기록을 저장했어요.',
    );
    if (out.status === 'invalid') {
      setErrors(out.errors);
      focusFirst(out.errors, ['checkedOn', 'views']);
    } else if (out.status === 'save_failed') setSaveFailed(true);
    else if (out.status === 'saved') {
      setDirty(dirtyKey, null);
      onClose();
    }
  }

  return (
    <form
      className={ps.form}
      noValidate
      aria-label="성과 기록"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h3 className={ps.sectionTitle}>성과 기록 남기기</h3>
      <ObservationFields values={obs} errors={errors} onChange={update} idPrefix="more" />
      {sameDay && (
        <p className={ps.info}>{formatDay(sameDay.checkedOn)} 기록이 이미 있어요. 저장하면 그 기록을 고쳐요.</p>
      )}
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      {saveFailed && <ErrorBand>{SAVE_FAILED}</ErrorBand>}
      <div className={ps.actions}>
        <Button type="submit" variant="action" busy={busy}>
          성과 기록 저장
        </Button>
        <CancelButton dirty={dirty} dirtyKey={dirtyKey} onClose={onClose} body="작성 중인 성과 기록은 사라져요." />
      </div>
    </form>
  );
}

function CancelButton({ dirty, dirtyKey, onClose, body }: { dirty: boolean; dirtyKey: string; onClose: () => void; body: string }) {
  const { confirm, setDirty, busy } = useStore();
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        if (dirty) {
          const go = await confirm({ title: '저장하지 않고 닫을까요?', body, stayLabel: '계속 작성', goLabel: '닫기' });
          if (!go) return;
          setDirty(dirtyKey, null);
        }
        onClose();
      }}
    >
      취소
    </Button>
  );
}
