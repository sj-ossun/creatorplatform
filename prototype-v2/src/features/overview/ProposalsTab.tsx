import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { choiceStyles, ErrorBand, Field, FieldGroup } from '../../components/Field/Field';
import { SAVE_FAILED } from '../../components/FeedbackComposer/FeedbackComposer';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { InternalNote } from '../../components/InternalNote/InternalNote';
import { Tag } from '../../components/Tag/Tag';
import { FORM_ERROR, type FieldErrors } from '../../domain/commands';
import { changeProposalStatus, proposalsOf } from '../../domain/proposals';
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

/**
 * 개인 상세 › 광고·커머스 제안 (6-B). 이 크루원이 받은 제안의 응답과, 수락으로 생긴 진행 기록(진행 상태·수익 기록).
 * 새 제안은 운영 관리 › 제안 탭에서 보낸다 (이 화면에서는 받는 사람을 미리 골라 연다). 저장은 발송이 아니다.
 */
export function ProposalsTab({ member }: { member: User }) {
  const { data, navigate } = useStore();
  const items = proposalsOf(data, member.id);
  const received = data.offerRecipients.filter((r) => r.userId === member.id);
  return (
    <>
      <p className={ps.muted}>이 크루원이 받은 광고 제안과 진행 기록이에요. 진행 상태와 수익 기록은 관리자에게만 보여요.</p>
      <div className={ps.actions}>
        <Button onClick={() => void navigate({ screen: 'overview', view: 'offers', offerId: 'new', presetRecipientId: member.id })}>
          이 크루원에게 새 제안 보내기
        </Button>
      </div>
      {received.length > 0 && (
        <ul className={styles.history} aria-label="받은 제안 응답">
          {received.map((r) => {
            const o = data.offers.find((x) => x.id === r.offerId);
            if (!o) return null;
            return (
              <li key={r.id}>
                <button type="button" className={styles.linkBtn} onClick={() => void navigate({ screen: 'overview', view: 'offers', offerId: o.id })}>
                  {o.brand} · {o.product}
                </button>{' '}
                — {o.cancelledAt ? '취소됨' : r.response === 'accepted' ? '수락' : r.response === 'declined' ? '거절' : '응답 대기'}
              </li>
            );
          })}
        </ul>
      )}
      {items.length === 0
        ? <EmptyState title="진행 기록이 없어요">제안을 수락하면 진행 기록이 생겨요.</EmptyState>
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
        {proposal.offerId ? <Tag>제안 수락으로 생긴 기록</Tag> : <Tag>이전 기록</Tag>}
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
