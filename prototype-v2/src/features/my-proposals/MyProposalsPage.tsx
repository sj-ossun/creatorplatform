import { useEffect, useRef, useState } from 'react';
import { withRo } from '../../domain/korean';
import { Button } from '../../components/Button/Button';
import { choiceStyles, ErrorBand, Field, FieldGroup } from '../../components/Field/Field';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { MetaParts } from '../../components/MetaParts/MetaParts';
import { Tag } from '../../components/Tag/Tag';
import { FORM_ERROR, type FieldErrors } from '../../domain/commands';
import { FORWARD_CHANNELS, forwardOffer, offersReceivedBy, recommendMembers, respondOffer, offerVersion } from '../../domain/offers';
import { proposalsForMember } from '../../domain/proposals';
import { getUser } from '../../domain/queries';
import { formatDay, formatList } from '../../domain/time';
import { DECLINE_REASON_LABEL, PROPOSAL_KIND_LABEL, PROPOSAL_STATUS_LABEL, type DeclineReason, type Offer, type OfferRecipient } from '../../domain/types';
import { useDirty, useStore } from '../../state/AppStore';
import { PageHeader, pageStyles as ps } from '../common/Page';
import { OfferFacts, OfferTags, ResponsePill } from '../offers/OfferBits';
import offerStyles from '../offers/Offers.module.css';
import styles from './MyProposals.module.css';

/**
 * 크루원 '내 제안' · 크루장 '받은 제안' (6-B, 사용자 결정).
 * 받은 광고 제안을 보고 수락·거절한다 (수락 후 철회 없음). 실제 진행은 담당자와 플랫폼 밖에서.
 * 크루장은 자기 크루원 여러 명에게 전달 기록(카톡 등)·추천을 남기고, 대리 응답(진행할 크루원 0명 이상)을 한다.
 * 크루원에게 직접 간 제안은 크루장에게 보이지 않는다. 관리자 내부 메모는 보이지 않는다.
 */
export function MyProposalsPage() {
  const { data, user, route } = useStore();
  const items = offersReceivedBy(data, user);
  const legacy = user.role === 'member' ? proposalsForMember(data, user).filter((p) => !data.proposals.find((x) => x.id === p.id)?.offerId) : [];
  const focus = route.screen === 'my-proposals' ? route.offerId : undefined;
  const isLeader = user.role === 'leader';
  return (
    <div className={`${ps.screen} ${ps.reading}`}>
      <PageHeader
        title={isLeader ? '받은 제안' : '내 제안'}
        help={
          isLeader
            ? '크루장에게 온 광고 제안이에요. 크루원에게는 카톡 등으로 직접 전하고, 여기에는 기록과 응답만 남겨요.'
            : '회사가 보낸 광고 제안이에요. 수락·거절만 여기서 하고, 실제 진행은 담당자와 플랫폼 밖에서 이어가요.'
        }
      />
      {items.length === 0 ? (
        <div className={ps.panel}>
          <EmptyState title="아직 받은 제안이 없어요">회사가 제안을 보내면 여기와 알림함에 보여요.</EmptyState>
        </div>
      ) : (
        <ul className={styles.list} aria-label="받은 제안 목록">
          {items.map(({ offer, recipient }) => (
            <li key={recipient.id}>
              <OfferCard offer={offer} rec={recipient} focus={focus === offer.id} />
            </li>
          ))}
        </ul>
      )}
      {legacy.length > 0 && (
        <section className={ps.section} aria-labelledby="legacy-title">
          <h2 className={ps.sectionTitle} id="legacy-title">
            이전 제안 기록
          </h2>
          <p className={ps.muted}>제안 보내기 기능 이전에 회사가 남긴 기록이에요. 읽기만 할 수 있어요.</p>
          <ul className={styles.list} aria-label="이전 제안 기록">
            {legacy.map((p) => (
              <li key={p.id} className={styles.card}>
                <div className={styles.head}>
                  <Tag>{PROPOSAL_KIND_LABEL[p.kind]}</Tag>
                  <h3 className={styles.brand}>{p.brand}</h3>
                  <span className={styles.status}>{PROPOSAL_STATUS_LABEL[p.status]}</span>
                </div>
                <p className={styles.content}>{p.content}</p>
                <p className={styles.meta}>
                  <MetaParts items={[`제안일 ${formatDay(p.proposedOn)}`, `담당 ${p.owner}`]} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function OfferCard({ offer, rec, focus }: { offer: Offer; rec: OfferRecipient; focus: boolean }) {
  const { data, user } = useStore();
  const ref = useRef<HTMLElement>(null);
  const now = new Date().toISOString();
  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ block: 'start' });
  }, [focus]);
  const open = rec.response === 'pending' && !offer.cancelledAt;
  const progress = data.proposals.filter((p) => p.offerId === offer.id && p.creatorId === user.id);
  return (
    <article ref={ref} className={offerStyles.card} data-dim={(!open && !focus) || undefined} aria-label={`${offer.brand} ${offer.product} 제안`}>
      <div className={offerStyles.meta}>
        {user.role === 'leader' ? <LeaderPill offer={offer} rec={rec} /> : <ResponsePill offer={offer} rec={rec} now={now} />}
        <OfferTags offer={offer} />
        <span>
          {formatList(offer.createdAt)} 도착 · 담당 {getUser(data, offer.createdBy)?.name}
        </span>
      </div>
      <h2 className={offerStyles.cardTitle}>
        {offer.brand} · {offer.product}
      </h2>
      <OfferFacts offer={offer} />
      {offer.cancelledAt && <p className={offerStyles.lock}>회사가 이 제안을 취소했어요.</p>}
      {rec.response !== 'pending' && <ResponseSummary rec={rec} />}
      {progress.length > 0 && <p className={offerStyles.cap}>진행 상황: {PROPOSAL_STATUS_LABEL[progress[0].status]} (담당자와 플랫폼 밖에서 진행해요)</p>}
      {open && <ChangedTerms offer={offer} />}
      {user.role === 'leader' ? (
        !offer.cancelledAt && <LeaderActions offer={offer} rec={rec} canRespond={open} />
      ) : (
        open && <RespondForm key={offerVersion(offer)} rec={rec} leader={false} version={offerVersion(offer)} />
      )}
    </article>
  );
}

function ResponseSummary({ rec }: { rec: OfferRecipient }) {
  const { data } = useStore();
  const name = (id: string) => getUser(data, id)?.name ?? '';
  return (
    <p className={offerStyles.cap}>
      {rec.respondedAt && formatList(rec.respondedAt)} ·{' '}
      {rec.respondedVersion && rec.respondedVersion > 1 ? `${rec.respondedVersion}번째 조건에 ` : ''}
      {rec.response === 'accepted' ? '수락했어요' : `거절했어요 (${DECLINE_REASON_LABEL[rec.declineReason!]}${rec.declineNote ? `: ${rec.declineNote}` : ''})`}
      {rec.proxyMemberIds && rec.proxyMemberIds.length > 0 && ` · 진행 크루원 ${rec.proxyMemberIds.map(name).join(', ')}`}
      {' '}· 응답 후에는 바꿀 수 없어요.
    </p>
  );
}

function MemberPicker({ value, onChange, label, error }: { value: string[]; onChange: (ids: string[]) => void; label: string; error?: string }) {
  const { data, user } = useStore();
  const members = data.users.filter((u) => u.role === 'member' && u.crewId === user.crewId);
  return (
    <FieldGroup legend={label} error={error}>
      {() => (
        <div className={offerStyles.chips}>
          {members.map((m) => (
            <label key={m.id} className={offerStyles.chip}>
              <input type="checkbox" checked={value.includes(m.id)} onChange={(e) => onChange(e.target.checked ? [...value, m.id] : value.filter((x) => x !== m.id))} />
              {m.name}
            </label>
          ))}
        </div>
      )}
    </FieldGroup>
  );
}

/**
 * 응답 (UI 개선 C, 사용자 확정): 같은 크기의 수락(주황)·거절(테두리) 버튼.
 * 크루원: 수락 → 확인 창 → 끝. 크루장: 수락 → 진행할 크루원 고르기 → 크루장으로 수락.
 * 거절 → 사유 고르기 → '거절 보내기'. 화면을 연 뒤 조건이 바뀌었으면 응답을 막고 최신 조건을 다시 보게 한다.
 */
function RespondForm({ rec, leader, version }: { rec: OfferRecipient; leader: boolean; version: number }) {
  const { user, execute, busy, confirm } = useStore();
  const [seenVersion] = useState(version);
  const [mode, setMode] = useState<'accepted' | 'declined' | ''>('');
  const [reason, setReason] = useState<DeclineReason | ''>('');
  const [note, setNote] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  useDirty(`offer-respond-${rec.id}`, mode !== '' && (reason !== '' || note !== '' || members.length > 0), '고르던 응답은 저장되지 않아요.');

  async function send(response: 'accepted' | 'declined') {
    const go = await confirm({
      title: response === 'accepted' ? '이 제안을 수락할까요?' : '이 제안을 거절할까요?',
      body: '응답한 뒤에는 바꿀 수 없어요. 결과는 담당 관리자에게 알림으로 가요.',
      stayLabel: '다시 볼게요',
      goLabel: response === 'accepted' ? '수락하기' : '거절하기',
    });
    if (!go) return;
    const out = await execute(
      (d) => respondOffer(d, user.id, rec.id, { response, reason, note, memberIds: members, seenVersion }, new Date().toISOString()),
      () => (response === 'accepted' ? '제안을 수락했어요. 담당자가 이어서 연락해요.' : '제안을 거절했어요.'),
    );
    if (out.status === 'invalid') setErrors(out.errors);
  }

  const reset = () => {
    setMode('');
    setReason('');
    setNote('');
    setMembers([]);
    setErrors({});
  };

  return (
    <div className={offerStyles.respond} aria-label={leader ? '크루장 대리 응답' : '제안 응답'} role="group">
      {leader && <h3 className={offerStyles.panelTitle}>대리 응답</h3>}
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      {mode === '' && (
        <div className={offerStyles.respButtons}>
          <Button variant="action" className={offerStyles.respBig} busy={busy} onClick={() => (leader ? setMode('accepted') : void send('accepted'))}>
            수락
          </Button>
          <Button className={offerStyles.respBig} disabled={busy} onClick={() => setMode('declined')}>
            거절
          </Button>
        </div>
      )}
      {mode === 'accepted' && leader && (
        <form
          className={ps.form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void send('accepted');
          }}
        >
          <MemberPicker value={members} onChange={setMembers} label="진행할 크루원 (선택, 여러 명 가능)" error={errors.members} />
          <div className={offerStyles.actions}>
            <Button type="submit" variant="action" busy={busy}>
              크루장으로 수락하기
            </Button>
            <Button onClick={reset} disabled={busy}>
              돌아가기
            </Button>
          </div>
        </form>
      )}
      {mode === 'declined' && (
        <form
          className={ps.form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason) {
              setErrors({ reason: '거절 사유를 고르세요.' });
              return;
            }
            void send('declined');
          }}
        >
          <FieldGroup legend="거절 사유" error={errors.reason}>
            {() => (
              <div className={choiceStyles.choicesRow}>
                {(Object.keys(DECLINE_REASON_LABEL) as DeclineReason[]).map((k) => (
                  <label key={k} className={choiceStyles.choice}>
                    <input type="radio" name={`reason-${rec.id}`} checked={reason === k} onChange={() => setReason(k)} />
                    {k === 'other' ? '기타(직접 입력)' : DECLINE_REASON_LABEL[k]}
                  </label>
                ))}
              </div>
            )}
          </FieldGroup>
          {reason === 'other' && (
            <Field label="기타 사유" error={errors.note}>
              {(p) => <input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
            </Field>
          )}
          <div className={offerStyles.actions}>
            {/* 거절은 주황으로 칠하지 않는다 (사용자 확정 규칙) */}
            <Button type="submit" variant="strong" busy={busy}>
              {leader ? '크루장으로 거절 보내기' : '거절 보내기'}
            </Button>
            <Button onClick={reset} disabled={busy}>
              돌아가기
            </Button>
          </div>
        </form>
      )}
      {leader && <p className={offerStyles.cap}>응답 이력에 ‘크루장 대리 응답’으로 남고, 관리자 알림함으로 가요.</p>}
    </div>
  );
}

/** 응답 전에 조건이 바뀌었으면 바뀐 항목과 시점 (UI 개선 C) */
function ChangedTerms({ offer }: { offer: Offer }) {
  const last = offer.revisions?.at(-1);
  if (!last) return null;
  return (
    <div className={offerStyles.changed} role="note">
      <p className={offerStyles.changedHead}>
        조건이 바뀌었어요 · <time dateTime={last.at}>{formatList(last.at)}</time> ({offerVersion(offer)}번째 조건)
      </p>
      <ul className={offerStyles.changedList}>
        {last.changes.map((c) => (
          <li key={c.field}>
            {c.field} <s>{c.from}</s> → <b>{c.to}</b>
          </li>
        ))}
      </ul>
      <p className={offerStyles.cap}>응답은 지금 보이는 최신 조건으로 기록돼요.</p>
    </div>
  );
}

/** 크루장 입장의 상태 (검토 3번): 대리 응답함 > 추천함 > 전달함 > 전달 전. 취소된 제안은 기존 표시 그대로 */
function LeaderPill({ offer, rec }: { offer: Offer; rec: OfferRecipient }) {
  const { data, user } = useStore();
  if (offer.cancelledAt) return <ResponsePill offer={offer} rec={rec} now={new Date().toISOString()} />;
  const label =
    rec.response !== 'pending'
      ? '대리 응답함'
      : data.offerRecommendations.some((r) => r.offerId === offer.id && r.leaderId === user.id)
        ? '추천함'
        : data.offerForwards.some((f) => f.offerId === offer.id && f.leaderId === user.id)
          ? '전달함'
          : '전달 전';
  return (
    <span className={offerStyles.pill} data-r={label === '전달 전' ? 'pending' : 'declined'}>
      {label}
    </span>
  );
}

type LeaderAction = 'fwd' | 'rec' | 'proxy';

/**
 * 크루장 받은 제안 (검토 3번, 사용자 확정 견본): 처음엔 입력 칸 없이 같은 모양 버튼 셋(전달 기록 · 크루원 추천 · 대신 응답).
 * 버튼은 입력 칸을 여는 것뿐이고(▾), 열린 칸의 저장 버튼을 눌러야 남는다. 한 번에 한 칸만 열리고, 주황은 열린 칸의 저장 버튼 하나.
 */
function LeaderActions({ offer, rec, canRespond }: { offer: Offer; rec: OfferRecipient; canRespond: boolean }) {
  const { data, user } = useStore();
  const [open, setOpen] = useState<LeaderAction | null>(null);
  const name = (id: string) => getUser(data, id)?.name ?? '';
  const forwards = data.offerForwards.filter((f) => f.offerId === offer.id && f.leaderId === user.id);
  const recs = data.offerRecommendations.filter((r) => r.offerId === offer.id && r.leaderId === user.id);
  const actions: { key: LeaderAction; label: string }[] = [
    { key: 'fwd', label: '전달 기록' },
    { key: 'rec', label: '크루원 추천' },
    ...(canRespond ? [{ key: 'proxy' as const, label: '대신 응답' }] : []),
  ];
  const panelId = (k: LeaderAction) => `leader-${k}-${offer.id}`;
  return (
    <div className={offerStyles.leaderBox}>
      <p className={offerStyles.openHint}>
        아래 버튼은 <b>입력 칸을 여는 버튼</b>이에요. 눌러도 바로 저장·응답되지 않아요. 열린 칸에서 저장 버튼을 눌러야 남아요.
      </p>
      <div className={offerStyles.leaderButtons} role="group" aria-label="크루장이 할 일">
        {actions.map((a) => (
          <Button key={a.key} aria-expanded={open === a.key} aria-controls={panelId(a.key)} onClick={() => setOpen(open === a.key ? null : a.key)}>
            {a.label} <span aria-hidden="true">{open === a.key ? '▴' : '▾'}</span>
          </Button>
        ))}
      </div>
      {open === 'fwd' && <ForwardForm id={panelId('fwd')} offer={offer} onClose={() => setOpen(null)} />}
      {open === 'rec' && <RecommendForm id={panelId('rec')} offer={offer} onClose={() => setOpen(null)} />}
      {open === 'proxy' && canRespond && <ProxyForm id={panelId('proxy')} key={offerVersion(offer)} rec={rec} version={offerVersion(offer)} onClose={() => setOpen(null)} />}
      {forwards.length > 0 && (
        <ol className={offerStyles.hist} aria-label="전달 이력">
          {forwards.map((f) => (
            <li key={f.id}>
              {formatList(f.createdAt)} · {f.memberIds.map(name).join(', ')}에게 {withRo(f.channel)} 전달{f.memo ? ` (${f.memo})` : ''}
            </li>
          ))}
        </ol>
      )}
      {recs.length > 0 && (
        <ol className={offerStyles.hist} aria-label="추천 이력">
          {recs.map((r) => (
            <li key={r.id}>
              {formatList(r.createdAt)} · {r.memberIds.map(name).join(', ')} 추천{r.sentMemberIds.length ? ` (관리자가 ${r.sentMemberIds.map(name).join(', ')}에게 보냄)` : ''}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StepLine({ save }: { save: string }) {
  return (
    <p className={offerStyles.step}>
      1단계 입력 → 2단계 <b>{save}</b>를 눌러야 저장돼요
    </p>
  );
}

function ForwardForm({ id, offer, onClose }: { id: string; offer: Offer; onClose: () => void }) {
  const { user, execute, busy } = useStore();
  const [members, setMembers] = useState<string[]>([]);
  const [channel, setChannel] = useState('카카오톡');
  const [memo, setMemo] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  useDirty(`offer-fwd-${offer.id}`, members.length > 0 || memo !== '', '고르던 전달 기록은 저장되지 않아요.');
  return (
    <form
      id={id}
      className={offerStyles.panel}
      noValidate
      aria-label="전달 기록"
      onSubmit={async (e) => {
        e.preventDefault();
        const out = await execute((d) => forwardOffer(d, user.id, offer.id, members, channel, memo, new Date().toISOString()), () => '전달 기록을 남겼어요.');
        if (out.status === 'invalid') setErrors(out.errors);
        else if (out.status === 'saved') onClose();
      }}
    >
      <StepLine save="전달 기록 남기기" />
      <p className={offerStyles.cap}>카톡 등으로 직접 전한 뒤 기록만 남겨요.</p>
      <MemberPicker value={members} onChange={setMembers} label="누구에게 전달했나요? (여러 명 가능)" error={errors.members} />
      <Field label="연락 수단" error={errors.channel}>
        {(p) => (
          <select {...p} value={channel} onChange={(e) => setChannel(e.target.value)}>
            {FORWARD_CHANNELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
      </Field>
      <Field label="메모" optional>
        {(p) => <input {...p} value={memo} onChange={(e) => setMemo(e.target.value)} />}
      </Field>
      <div className={offerStyles.actions}>
        <Button type="submit" variant="action" busy={busy}>
          전달 기록 남기기
        </Button>
        <Button onClick={onClose} disabled={busy}>
          취소
        </Button>
      </div>
    </form>
  );
}

function RecommendForm({ id, offer, onClose }: { id: string; offer: Offer; onClose: () => void }) {
  const { user, execute, busy } = useStore();
  const [members, setMembers] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  useDirty(`offer-rec-${offer.id}`, members.length > 0 || reason !== '', '고르던 추천은 저장되지 않아요.');
  return (
    <form
      id={id}
      className={offerStyles.panel}
      noValidate
      aria-label="크루원 추천"
      onSubmit={async (e) => {
        e.preventDefault();
        const out = await execute((d) => recommendMembers(d, user.id, offer.id, members, reason, new Date().toISOString()), () => '추천을 보냈어요. 관리자가 확인한 뒤 크루원에게 제안을 보내요.');
        if (out.status === 'invalid') setErrors(out.errors);
        else if (out.status === 'saved') onClose();
      }}
    >
      <StepLine save="추천 보내기" />
      <p className={offerStyles.cap}>관리자가 확인한 뒤 그 크루원에게 제안을 보내요.</p>
      <MemberPicker value={members} onChange={setMembers} label="추천할 크루원 (여러 명 가능)" error={errors.members} />
      <Field label="추천 사유" error={errors.reason}>
        {(p) => <input {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
      <div className={offerStyles.actions}>
        <Button type="submit" variant="action" busy={busy}>
          추천 보내기
        </Button>
        <Button onClick={onClose} disabled={busy}>
          취소
        </Button>
      </div>
    </form>
  );
}

/** 대신 응답: 수락·거절을 고르고(수락이면 진행할 크루원, 거절이면 사유) '대신 응답 보내기' → 확인 창 → 응답. 바로 수락되는 버튼은 없다 */
function ProxyForm({ id, rec, version, onClose }: { id: string; rec: OfferRecipient; version: number; onClose: () => void }) {
  const { user, execute, busy, confirm } = useStore();
  const [seenVersion] = useState(version);
  const [choice, setChoice] = useState<'accepted' | 'declined' | ''>('');
  const [reason, setReason] = useState<DeclineReason | ''>('');
  const [note, setNote] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  useDirty(`offer-proxy-${rec.id}`, choice !== '' || members.length > 0, '고르던 응답은 저장되지 않아요.');
  return (
    <form
      id={id}
      className={offerStyles.panel}
      noValidate
      aria-label="크루장 대리 응답"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!choice) return setErrors({ choice: '수락이나 거절을 고르세요.' });
        if (choice === 'declined' && !reason) return setErrors({ reason: '거절 사유를 고르세요.' });
        const go = await confirm({
          title: choice === 'accepted' ? '크루장으로 이 제안을 수락할까요?' : '크루장으로 이 제안을 거절할까요?',
          body: '응답한 뒤에는 바꿀 수 없어요. 응답 이력에 ‘크루장 대리 응답’으로 남고, 관리자 알림함으로 가요.',
          stayLabel: '다시 볼게요',
          goLabel: choice === 'accepted' ? '수락하기' : '거절하기',
        });
        if (!go) return;
        const out = await execute(
          (d) => respondOffer(d, user.id, rec.id, { response: choice, reason, note, memberIds: members, seenVersion }, new Date().toISOString()),
          () => (choice === 'accepted' ? '크루장으로 제안을 수락했어요.' : '크루장으로 제안을 거절했어요.'),
        );
        if (out.status === 'invalid') setErrors(out.errors);
      }}
    >
      <StepLine save="대신 응답 보내기" />
      <p className={offerStyles.cap}>크루원이 직접 답하기 어려울 때만 써요. 응답 이력에 ‘크루장 대리 응답’으로 남아요.</p>
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      <FieldGroup legend="응답" error={errors.choice}>
        {() => (
          <div className={choiceStyles.choicesRow}>
            <label className={choiceStyles.choice}>
              <input type="radio" name={`proxy-${rec.id}`} checked={choice === 'accepted'} onChange={() => setChoice('accepted')} />
              수락
            </label>
            <label className={choiceStyles.choice}>
              <input type="radio" name={`proxy-${rec.id}`} checked={choice === 'declined'} onChange={() => setChoice('declined')} />
              거절
            </label>
          </div>
        )}
      </FieldGroup>
      {choice === 'accepted' && <MemberPicker value={members} onChange={setMembers} label="진행할 크루원 (선택, 여러 명 가능)" error={errors.members} />}
      {choice === 'declined' && (
        <>
          <FieldGroup legend="거절 사유" error={errors.reason}>
            {() => (
              <div className={choiceStyles.choicesRow}>
                {(Object.keys(DECLINE_REASON_LABEL) as DeclineReason[]).map((k) => (
                  <label key={k} className={choiceStyles.choice}>
                    <input type="radio" name={`proxy-reason-${rec.id}`} checked={reason === k} onChange={() => setReason(k)} />
                    {k === 'other' ? '기타(직접 입력)' : DECLINE_REASON_LABEL[k]}
                  </label>
                ))}
              </div>
            )}
          </FieldGroup>
          {reason === 'other' && (
            <Field label="기타 사유" error={errors.note}>
              {(p) => <input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
            </Field>
          )}
        </>
      )}
      <div className={offerStyles.actions}>
        <Button type="submit" variant="action" busy={busy}>
          대신 응답 보내기
        </Button>
        <Button onClick={onClose} disabled={busy}>
          취소
        </Button>
      </div>
    </form>
  );
}
