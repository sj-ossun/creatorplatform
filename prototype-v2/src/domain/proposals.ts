/**
 * 광고·커머스 제안 이력 (F-09). 관리자 전용. 저장은 메시지 발송이 아니다.
 */
import { FORM_ERROR, type CommandResult, type FieldErrors } from './commands';
import { getUser } from './queries';
import { isValidDay } from './time';
import {
  PROPOSAL_STATUSES,
  type AppData,
  type ID,
  type Instant,
  type Proposal,
  type ProposalKind,
  type ProposalStatus,
  type User,
} from './types';

export const PROPOSAL_ERR = {
  proposedOn: '제안일을 입력해 주세요.',
  proposedOnInvalid: '제안일을 다시 확인해 주세요.',
  owner: '담당자를 입력해 주세요.',
  kind: '구분을 고르세요.',
  brand: '브랜드·상품명을 입력해 주세요.',
  content: '제안 내용을 입력해 주세요.',
  status: '진행 상태를 고르세요.',
  notAllowed: '이 작업을 할 수 있는 예시 사용자가 아니에요.',
} as const;

export interface ProposalInput {
  proposedOn: string;
  owner: string;
  kind: ProposalKind | '';
  brand: string;
  content: string;
  status: ProposalStatus | '';
  internalMemo: string;
}

/** 관리자가 담당 크루의 크리에이터를 맡는지 */
export function managesCreator(data: AppData, actor: User | undefined, creatorId: ID): boolean {
  const creator = getUser(data, creatorId);
  return !!actor && actor.role === 'admin' && !!creator?.crewId && actor.managedCrewIds.includes(creator.crewId);
}

export function proposalsOf(data: AppData, creatorId: ID): Proposal[] {
  return data.proposals
    .filter((p) => p.creatorId === creatorId)
    .sort((a, b) => b.proposedOn.localeCompare(a.proposedOn) || b.createdAt.localeCompare(a.createdAt));
}

export function validateProposal(input: ProposalInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.proposedOn) errors.proposedOn = PROPOSAL_ERR.proposedOn;
  else if (!isValidDay(input.proposedOn)) errors.proposedOn = PROPOSAL_ERR.proposedOnInvalid;
  if (!input.owner.trim()) errors.owner = PROPOSAL_ERR.owner;
  if (input.kind !== 'ad' && input.kind !== 'commerce') errors.kind = PROPOSAL_ERR.kind;
  if (!input.brand.trim()) errors.brand = PROPOSAL_ERR.brand;
  if (!input.content.trim()) errors.content = PROPOSAL_ERR.content;
  if (!PROPOSAL_STATUSES.includes(input.status as ProposalStatus)) errors.status = PROPOSAL_ERR.status;
  return errors;
}

export function createProposal(
  data: AppData,
  actorId: ID,
  creatorId: ID,
  input: ProposalInput,
  now: Instant,
): CommandResult<Proposal> {
  const actor = getUser(data, actorId);
  if (!managesCreator(data, actor, creatorId)) return { ok: false, errors: { [FORM_ERROR]: PROPOSAL_ERR.notAllowed } };
  const errors = validateProposal(input);
  if (Object.keys(errors).length) return { ok: false, errors };
  const seq = data.seq + 1;
  const status = input.status as ProposalStatus;
  const proposal: Proposal = {
    id: `proposal-${seq}`,
    creatorId,
    proposedOn: input.proposedOn,
    owner: input.owner.trim(),
    kind: input.kind as ProposalKind,
    brand: input.brand.trim(),
    content: input.content.trim(),
    status,
    internalMemo: input.internalMemo.trim(),
    createdBy: actorId,
    createdAt: now,
    history: [{ from: null, to: status, by: actorId, at: now }],
  };
  return { ok: true, data: { ...data, seq, proposals: [...data.proposals, proposal] }, value: proposal };
}

/**
 * 진행 상태 수동 변경. 어떤 상태로든 바꿀 수 있다.
 * 같은 값으로 다시 저장하면 이력을 늘리지 않고 데이터도 그대로 둔다.
 */
export function changeProposalStatus(
  data: AppData,
  actorId: ID,
  proposalId: ID,
  status: ProposalStatus,
  now: Instant,
): CommandResult<{ proposal: Proposal; changed: boolean }> {
  const actor = getUser(data, actorId);
  const proposal = data.proposals.find((p) => p.id === proposalId);
  if (!proposal || !managesCreator(data, actor, proposal.creatorId)) {
    return { ok: false, errors: { [FORM_ERROR]: PROPOSAL_ERR.notAllowed } };
  }
  if (!PROPOSAL_STATUSES.includes(status)) return { ok: false, errors: { status: PROPOSAL_ERR.status } };
  if (proposal.status === status) return { ok: true, data, value: { proposal, changed: false } };
  const updated: Proposal = {
    ...proposal,
    status,
    history: [...proposal.history, { from: proposal.status, to: status, by: actorId, at: now }],
  };
  return {
    ok: true,
    data: { ...data, proposals: data.proposals.map((p) => (p.id === proposalId ? updated : p)) },
    value: { proposal: updated, changed: true },
  };
}

/** 크루원 본인이 보는 제안 (사용자 결정): '제안 전달' 이후 상태만, 읽기 전용. 내부 메모는 넘기지 않는다 */
export const MEMBER_VISIBLE_STATUSES: ProposalStatus[] = ['delivered', 'negotiating', 'confirmed', 'on_hold', 'closed'];

export interface MemberProposalView {
  id: ID;
  proposedOn: string;
  kind: Proposal['kind'];
  brand: string;
  content: string;
  status: ProposalStatus;
  owner: string;
  updatedAt: string;
}

export function proposalsForMember(data: AppData, member: User): MemberProposalView[] {
  if (member.role !== 'member') return [];
  return proposalsOf(data, member.id)
    .filter((p) => MEMBER_VISIBLE_STATUSES.includes(p.status))
    .map((p) => ({
      id: p.id,
      proposedOn: p.proposedOn,
      kind: p.kind,
      brand: p.brand,
      content: p.content,
      status: p.status,
      owner: p.owner,
      updatedAt: p.history.at(-1)?.at ?? p.createdAt,
    }));
}
