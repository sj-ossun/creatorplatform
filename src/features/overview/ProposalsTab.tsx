import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { choiceStyles, ErrorBand, Field, FieldGroup } from '../../components/Field/Field';
import { SAVE_FAILED } from '../../components/FeedbackComposer/FeedbackComposer';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { InternalNote } from '../../components/InternalNote/InternalNote';
import { Tag } from '../../components/Tag/Tag';
import { FORM_ERROR, type FieldErrors } from '../../domain/commands';
import { changeProposalStatus, createProposal, proposalsOf, validateProposal, type ProposalInput } from '../../domain/proposals';
import { getUser } from '../../domain/queries';
import { formatDay, formatDetail, todayKst } from '../../domain/time';
import {
  PROPOSAL_KIND_LABEL,
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUSES,
  type Proposal,
  type ProposalStatus,
  type User,
} from '../../domain/types';
import { useDirty, useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';
import { withRo } from '../../domain/korean';
import { formatWon, REVENUE_STATUSES, revenueOf, saveRevenue, type RevenueInput } from '../../domain/revenue';
import { PAY_STATUS_LABEL, type PayStatus } from '../../domain/types';
import styles from './Overview.module.css';

/** 광고·커머스 제안 (F-09). 저장은 기록일 뿐 발송이 아니다. */
export function ProposalsTab({ member }: { member: User }) {
  const { data } = useStore();
  const [adding, setAdding] = useState(false);
  const items = proposalsOf(data, member.id);

  return (
    <>
      <p className={ps.muted}>외부에서 진행한 제안을 사람이 기록하는 곳이에요. 저장해도 크리에이터에게 아무것도 보내지 않아요.</p>
      {adding ? (
        <ProposalForm member={member} onClose={() => setAdding(false)} />
      ) : (
        <div className={ps.actions}>
          <Button onClick={() => setAdding(true)}>제안 기록 추가</Button>
        </div>
      )}
      {items.length === 0
        ? !adding && <EmptyState title="기록된 제안이 없어요">제안을 전달했거나 준비 중이면 기록을 추가하세요.</EmptyState>
        : items.map((p) => <ProposalCard key={p.id} proposal={p} />)}
    </>
  );
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const { data, user, execute, busy } = useStore();
  const [next, setNext] = useState<ProposalStatus>(proposal.status);
  const [saveFailed, setSaveFailed] = useState(false);
  const changed = next !== proposal.status;
  useDirty(`proposal-status-${proposal.id}`, changed, '바꾸던 진행 상태는 저장되지 않아요.');

  async function saveStatus() {
    setSaveFailed(false);
    const out = await execute(
      (d) => changeProposalStatus(d, user.id, proposal.id, next, new Date().toISOString()),
      (v) => {
        const label = PROPOSAL_STATUS_LABEL[v.proposal.status];
        return `상태를 ‘${label}’${withRo(label).slice(label.length)} 바꿨어요.`;
      },
    );
    if (out.status === 'save_failed') setSaveFailed(true);
  }

  const history = [...proposal.history].reverse();
  return (
    <article className={styles.proposal} aria-label={`${proposal.brand} 제안`}>
      <div className={styles.proposalHead}>
        <span className={styles.brand}>{proposal.brand}</span>
        <Tag>{PROPOSAL_KIND_LABEL[proposal.kind]}</Tag>
        <Tag>{PROPOSAL_STATUS_LABEL[proposal.status]}</Tag>
      </div>
      <p className={ps.muted}>
        {formatDay(proposal.proposedOn)} 제안, 담당 {proposal.owner}
      </p>
      <p className={ps.prose}>{proposal.content}</p>
      {proposal.internalMemo && <InternalNote>{proposal.internalMemo}</InternalNote>}
      <div className={styles.statusRow}>
        <Field label="진행 상태">
          {(p) => (
            <select
              {...p}
              name={`status-${proposal.id}`}
              value={next}
              disabled={busy}
              onChange={(e) => setNext(e.target.value as ProposalStatus)}
            >
              {PROPOSAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROPOSAL_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Button onClick={() => void saveStatus()} disabled={!changed} busy={busy && changed}>
          {changed ? '상태 저장' : '지금과 같은 상태'}
        </Button>
      </div>
      {saveFailed && <ErrorBand>{SAVE_FAILED}</ErrorBand>}
      {REVENUE_STATUSES.includes(proposal.status) && <RevenueEditor key={revenueOf(data, proposal.id)?.updatedAt ?? 'new'} proposal={proposal} />}
      <details className={styles.details}>
        <summary>변경 이력 {proposal.history.length}건</summary>
        <ol className={styles.history}>
          {history.map((h, i) => (
            <li key={i}>
              {h.from ? `${PROPOSAL_STATUS_LABEL[h.from]} → ${PROPOSAL_STATUS_LABEL[h.to]}` : `${withRo(PROPOSAL_STATUS_LABEL[h.to])} 등록`},{' '}
              {getUser(data, h.by)?.name} · <time dateTime={h.at}>{formatDetail(h.at)}</time>
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}

function ProposalForm({ member, onClose }: { member: User; onClose: () => void }) {
  const { user, execute, busy, setDirty, confirm } = useStore();
  const initial: ProposalInput = {
    proposedOn: todayKst(),
    owner: user.name,
    kind: '',
    brand: '',
    content: '',
    status: '',
    internalMemo: '',
  };
  const [v, setV] = useState<ProposalInput>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const dirtyKey = `proposal-form-${member.id}`;
  const dirty = (Object.keys(initial) as (keyof ProposalInput)[]).some((k) => v[k] !== initial[k]);
  useDirty(dirtyKey, dirty, '작성 중인 제안 기록은 사라져요.');

  function update(patch: Partial<ProposalInput>) {
    const next = { ...v, ...patch };
    setV(next);
    if (Object.keys(errors).length) {
      const fresh = validateProposal(next);
      setErrors((prev) => {
        const out: FieldErrors = {};
        for (const k of Object.keys(prev)) if (fresh[k]) out[k] = fresh[k];
        return out;
      });
    }
  }

  async function save() {
    setSaveFailed(false);
    const out = await execute(
      (d) => createProposal(d, user.id, member.id, v, new Date().toISOString()),
      () => '제안 기록을 저장했어요.',
    );
    if (out.status === 'invalid') {
      setErrors(out.errors);
      const first = ['proposedOn', 'owner', 'kind', 'brand', 'content', 'status'].find((k) => out.errors[k]);
      if (first) document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
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
      aria-label="제안 기록"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h3 className={ps.sectionTitle}>{member.name} 제안 기록 추가</h3>
      <Field label="제안일" error={errors.proposedOn} help="한국 시간 기준이에요.">
        {(p) => <input {...p} data-field="proposedOn" name="proposedOn" type="date" value={v.proposedOn} onChange={(e) => update({ proposedOn: e.target.value })} />}
      </Field>
      <Field label="담당자" error={errors.owner}>
        {(p) => <input {...p} data-field="owner" name="owner" value={v.owner} onChange={(e) => update({ owner: e.target.value })} />}
      </Field>
      <FieldGroup legend="구분" error={errors.kind}>
        {() => (
          <div className={choiceStyles.choicesRow}>
            {(['ad', 'commerce'] as const).map((k, i) => (
              <label key={k} className={choiceStyles.choice}>
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  data-field={i === 0 ? 'kind' : undefined}
                  checked={v.kind === k}
                  onChange={() => update({ kind: k })}
                />
                {PROPOSAL_KIND_LABEL[k]}
              </label>
            ))}
          </div>
        )}
      </FieldGroup>
      <Field label="브랜드·상품명" error={errors.brand}>
        {(p) => <input {...p} data-field="brand" name="brand" value={v.brand} onChange={(e) => update({ brand: e.target.value })} />}
      </Field>
      <Field label="제안 내용" error={errors.content} multiline>
        {(p) => <textarea {...p} data-field="content" name="content" rows={4} value={v.content} onChange={(e) => update({ content: e.target.value })} />}
      </Field>
      <Field label="진행 상태" error={errors.status}>
        {(p) => (
          <select {...p} data-field="status" name="status" value={v.status} onChange={(e) => update({ status: e.target.value as ProposalStatus })}>
            <option value="">고르세요</option>
            {PROPOSAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROPOSAL_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="내부 메모" optional multiline help="관리자에게만 보여요. 크루장·크루원 화면에는 나오지 않아요.">
        {(p) => <textarea {...p} name="internalMemo" rows={3} value={v.internalMemo} onChange={(e) => update({ internalMemo: e.target.value })} />}
      </Field>
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      {saveFailed && <ErrorBand>{SAVE_FAILED}</ErrorBand>}
      <div className={ps.actions}>
        <Button type="submit" variant="action" busy={busy}>
          제안 기록 저장
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            if (dirty) {
              const go = await confirm({ title: '저장하지 않고 닫을까요?', body: '작성 중인 제안 기록은 사라져요.', stayLabel: '계속 작성', goLabel: '닫기' });
              if (!go) return;
              setDirty(dirtyKey, null);
            }
            onClose();
          }}
        >
          취소
        </Button>
      </div>
    </form>
  );
}

/**
 * 수익 기록 (5단계, 사용자 결정): 진행 확정·종료된 제안에 금액 하나 + 지급 여부. 관리자만 입력.
 * 크리에이터 본인의 '내 성과'에 보이고, 크루장에게는 보이지 않는다. 정산·지급 처리가 아니다.
 */
function RevenueEditor({ proposal }: { proposal: Proposal }) {
  const { data, user, execute, busy } = useStore();
  const existing = revenueOf(data, proposal.id);
  const initial: RevenueInput = {
    amount: existing?.amount === null || existing === undefined ? '' : String(existing.amount),
    payStatus: existing?.payStatus ?? '',
    basisOn: existing?.basisOn ?? todayKst(),
  };
  const [v, setV] = useState<RevenueInput>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const dirty = v.amount !== initial.amount || v.payStatus !== initial.payStatus || v.basisOn !== initial.basisOn;
  useDirty(`revenue-${proposal.id}`, dirty, '입력하던 수익 기록은 저장되지 않아요.');
  return (
    <form
      className={styles.revenue}
      noValidate
      aria-label={`${proposal.brand} 수익 기록`}
      onSubmit={async (e) => {
        e.preventDefault();
        const out = await execute((d) => saveRevenue(d, user.id, proposal.id, v, new Date().toISOString()), () => '수익 기록을 저장했어요. 정산·지급 처리는 아니에요.');
        if (out.status === 'invalid') setErrors(out.errors);
      }}
    >
      <p className={styles.revenueHead}>
        수익 기록 <span className={ps.muted}>· 기록용이며 정산이 아니에요{existing && existing.amount !== null ? ` · 지금 ${formatWon(existing.amount)} ${PAY_STATUS_LABEL[existing.payStatus]}` : ''}</span>
      </p>
      <div className={styles.revenueRow}>
        <Field label="금액(원)" optional error={errors.amount}>
          {(p) => <input {...p} name={`amount-${proposal.id}`} inputMode="numeric" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} />}
        </Field>
        <FieldGroup legend="지급 여부" error={errors.payStatus}>
          {() => (
            <div className={choiceStyles.choicesRow}>
              {(['scheduled', 'paid'] as PayStatus[]).map((k) => (
                <label key={k} className={choiceStyles.choice}>
                  <input type="radio" name={`pay-${proposal.id}`} checked={v.payStatus === k} onChange={() => setV({ ...v, payStatus: k })} />
                  {PAY_STATUS_LABEL[k]}
                </label>
              ))}
            </div>
          )}
        </FieldGroup>
        <Field label="기준일" error={errors.basisOn} help="월별 합계에 쓰는 날짜예요.">
          {(p) => <input {...p} type="date" name={`basis-${proposal.id}`} value={v.basisOn} onChange={(e) => setV({ ...v, basisOn: e.target.value })} />}
        </Field>
      </div>
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      <div>
        <Button type="submit" busy={busy} disabled={!dirty}>
          {existing ? '수익 기록 고치기' : '수익 기록 저장'}
        </Button>
      </div>
    </form>
  );
}
