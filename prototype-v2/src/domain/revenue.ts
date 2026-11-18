/**
 * 수익 기록 (5단계, 사용자 결정). 제안 1건에 금액 하나 + 지급 여부(지급 예정·지급 완료).
 * 관리자(그 크리에이터의 담당)만 입력한다. 진행 확정·종료된 제안에만 남긴다.
 * 크루원은 본인 기록만 읽고, 크루장은 볼 수 없다. 정산·지급 처리가 아니다.
 * 실제 운영 방식을 확인한 뒤 바뀔 수 있다.
 */
import { FORM_ERROR, type CommandResult, type FieldErrors } from './commands';
import { managesCreator } from './proposals';
import { getUser } from './queries';
import { isValidDay } from './time';
import type { AppData, ID, Instant, PayStatus, Proposal, RevenueRecord, User } from './types';

export const REVENUE_STATUSES: Proposal['status'][] = ['confirmed', 'closed'];

export const REVENUE_ERR = {
  notAllowed: '이 제안의 수익을 기록할 수 있는 계정이 아니에요.',
  status: '진행 확정이나 종료된 제안에만 수익을 기록해요.',
  amount: '금액은 0 이상의 정수(원)로 입력하거나 비워 두세요.',
  payStatus: '지급 여부를 고르세요.',
  basisOn: '기준일을 확인해 주세요.',
} as const;

export interface RevenueInput {
  amount: string;
  payStatus: PayStatus | '';
  basisOn: string;
}

export function revenueOf(data: AppData, proposalId: ID): RevenueRecord | undefined {
  return data.revenues.find((r) => r.proposalId === proposalId);
}

export function parseAmount(raw: string): { ok: true; value: number | null } | { ok: false } {
  const t = raw.replace(/[,\s원]/g, '');
  if (t === '') return { ok: true, value: null };
  if (!/^\d+$/.test(t)) return { ok: false };
  return { ok: true, value: Number(t) };
}

export function saveRevenue(data: AppData, actorId: ID, proposalId: ID, input: RevenueInput, now: Instant): CommandResult<RevenueRecord> {
  const actor = getUser(data, actorId);
  const proposal = data.proposals.find((p) => p.id === proposalId);
  if (!proposal || !managesCreator(data, actor, proposal.creatorId)) return { ok: false, errors: { [FORM_ERROR]: REVENUE_ERR.notAllowed } };
  if (!REVENUE_STATUSES.includes(proposal.status)) return { ok: false, errors: { [FORM_ERROR]: REVENUE_ERR.status } };
  const errors: FieldErrors = {};
  const amount = parseAmount(input.amount);
  if (!amount.ok) errors.amount = REVENUE_ERR.amount;
  if (input.payStatus !== 'scheduled' && input.payStatus !== 'paid') errors.payStatus = REVENUE_ERR.payStatus;
  if (!isValidDay(input.basisOn)) errors.basisOn = REVENUE_ERR.basisOn;
  if (Object.keys(errors).length || !amount.ok) return { ok: false, errors };
  const existing = revenueOf(data, proposalId);
  const record: RevenueRecord = {
    id: existing?.id ?? `revenue-${data.seq + 1}`,
    proposalId,
    amount: amount.value,
    payStatus: input.payStatus as PayStatus,
    basisOn: input.basisOn,
    updatedBy: actorId,
    updatedAt: now,
  };
  const revenues = existing ? data.revenues.map((r) => (r.id === existing.id ? record : r)) : [...data.revenues, record];
  return { ok: true, data: { ...data, seq: existing ? data.seq : data.seq + 1, revenues }, value: record };
}

export interface MemberRevenueRow {
  proposal: Proposal;
  record: RevenueRecord;
}

/** 크루원 본인의 수익 기록 (크루장·다른 크루원에게는 빈 목록) */
export function revenuesForMember(data: AppData, viewer: User): MemberRevenueRow[] {
  if (viewer.role !== 'member') return [];
  return data.proposals
    .filter((p) => p.creatorId === viewer.id)
    .map((p) => ({ proposal: p, record: revenueOf(data, p.id) }))
    .filter((x): x is MemberRevenueRow => !!x.record)
    .sort((a, b) => b.record.basisOn.localeCompare(a.record.basisOn));
}

export function sumRevenue(rows: RevenueRecord[]) {
  let paid = 0;
  let scheduled = 0;
  let missing = 0;
  for (const r of rows) {
    if (r.amount === null) missing++;
    else if (r.payStatus === 'paid') paid += r.amount;
    else scheduled += r.amount;
  }
  return { paid, scheduled, total: paid + scheduled, missing };
}

/** 관리자 월별 합계 (기준일의 월, 담당 크루 크리에이터) */
export function monthlyRevenue(data: AppData, admin: User): { month: string; paid: number; scheduled: number }[] {
  if (admin.role !== 'admin') return [];
  const map = new Map<string, { paid: number; scheduled: number }>();
  for (const r of data.revenues) {
    const p = data.proposals.find((x) => x.id === r.proposalId);
    if (!p || !managesCreator(data, admin, p.creatorId) || r.amount === null) continue;
    const month = r.basisOn.slice(0, 7);
    const cur = map.get(month) ?? { paid: 0, scheduled: 0 };
    cur[r.payStatus === 'paid' ? 'paid' : 'scheduled'] += r.amount;
    map.set(month, cur);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }));
}

export function formatWon(n: number) {
  return `${n.toLocaleString('ko-KR')}원`;
}
