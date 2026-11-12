import { useState } from 'react';
import { Breadcrumbs } from '../../components/Breadcrumbs/Breadcrumbs';
import { withRo } from '../../domain/korean';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { choiceStyles, ErrorBand, Field, FieldGroup } from '../../components/Field/Field';
import { InternalNote } from '../../components/InternalNote/InternalNote';
import { FORM_ERROR, type FieldErrors } from '../../domain/commands';
import {
  alreadyOffered,
  archiveRecommendation,
  cancelOffer,
  isLocked,
  isStale,
  NO_RESPONSE_DAYS,
  OFFER_CATEGORIES,
  OFFER_FORMATS,
  offerOf,
  offersForAdmin,
  recipientsOf,
  remindedToday,
  remindRecipient,
  selectableRecipients,
  sendFromRecommendation,
  sendOffer,
  updateOffer,
  type OfferInput,
} from '../../domain/offers';
import { getCrew, getUser } from '../../domain/queries';
import { formatDetail, formatList, todayKst } from '../../domain/time';
import { DECLINE_REASON_LABEL, PROPOSAL_KIND_LABEL, type Offer, type OfferRecommendation } from '../../domain/types';
import { useDirty, useStore } from '../../state/AppStore';
import type { Route } from '../../state/routes';
import { pageStyles as ps } from '../common/Page';
import { OfferFacts, OfferTags, ResponsePill, won } from './OfferBits';
import styles from './Offers.module.css';

type OverviewRoute = Extract<Route, { screen: 'overview' }>;

/** 운영 관리 › 제안 탭 (6-B) */
export function AdminOffers({ route }: { route: OverviewRoute }) {
  if (route.offerId === 'new') return <OfferForm presetRecipientId={route.presetRecipientId} />;
  if (route.offerId && route.offerEdit) return <OfferForm editId={route.offerId} />;
  if (route.offerId) return <OfferDetail offerId={route.offerId} />;
  return <OffersList />;
}

function OffersList() {
  const { data, user, navigate } = useStore();
  const now = new Date().toISOString();
  const offers = offersForAdmin(data, user);
  return (
    <div className={ps.group}>
      <div className={ps.pageHead}>
        <p className={ps.muted}>관리자가 보낸 광고 제안과 받는 사람별 응답이에요. 실제 진행·계약·정산은 플랫폼 밖에서 해요.</p>
        <Button variant="action" onClick={() => void navigate({ screen: 'overview', view: 'offers', offerId: 'new' })}>
          새 제안 보내기
        </Button>
      </div>
      {offers.length === 0 ? (
        <div className={ps.panel}>
          <EmptyState title="보낸 제안이 없어요" />
        </div>
      ) : (
        <div className={styles.panel}>
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label="보낸 제안 목록">
              <thead>
                <tr>
                  <th scope="col">제안</th>
                  <th scope="col">형식</th>
                  <th scope="col">받는 사람</th>
                  <th scope="col">응답</th>
                  <th scope="col">보낸 날</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => {
                  const recs = recipientsOf(data, o.id);
                  const acc = recs.filter((r) => r.response === 'accepted').length;
                  const dec = recs.filter((r) => r.response === 'declined').length;
                  const wait = recs.length - acc - dec;
                  const stale = recs.filter((r) => isStale(r, o, now)).length;
                  const recCount = data.offerRecommendations.filter((x) => x.offerId === o.id && !x.archivedAt).length;
                  return (
                    <tr key={o.id}>
                      <td>
                        <button type="button" className={styles.rowBtn} onClick={() => void navigate({ screen: 'overview', view: 'offers', offerId: o.id })}>
                          {o.brand} · {o.product}
                        </button>
                        {o.cancelledAt && <span className={ps.muted}> (취소됨)</span>}
                      </td>
                      <td>{PROPOSAL_KIND_LABEL[o.format]}</td>
                      <td>
                        {o.recipientType === 'leader' ? '크루장' : '크루원'} {recs.length}명
                      </td>
                      <td>
                        수락 {acc} · 거절 {dec} · 대기 {wait}
                        {stale > 0 && <strong> · 응답 없음 {stale}</strong>}
                        {recCount > 0 && <strong> · 추천 {recCount}</strong>}
                      </td>
                      <td>{formatList(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY: OfferInput = { brand: '', product: '', category: '', description: '', format: '', price: '', uploadOn: '', note: '', internalMemo: '', recipientType: 'member', recipientIds: [] };

function OfferForm({ editId, presetRecipientId }: { editId?: string; presetRecipientId?: string }) {
  const { data, user, execute, busy, navigate, setDirty, confirm } = useStore();
  const editing = editId ? offerOf(data, editId) : undefined;
  const preset = presetRecipientId ? getUser(data, presetRecipientId) : undefined;
  const initial: OfferInput = editing
    ? {
        brand: editing.brand,
        product: editing.product,
        category: editing.category,
        description: editing.description,
        format: editing.format,
        price: String(editing.price),
        uploadOn: editing.uploadOn,
        note: editing.note,
        internalMemo: editing.internalMemo ?? '',
        recipientType: editing.recipientType,
        recipientIds: recipientsOf(data, editing.id).map((r) => r.userId),
      }
    : {
        ...EMPTY,
        category: preset ? (getCrew(data, preset.crewId)?.category ?? '') : '',
        recipientType: preset?.role === 'leader' ? 'leader' : 'member',
        recipientIds: preset ? [preset.id] : [],
      };
  const [v, setV] = useState<OfferInput>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [filterCat, setFilterCat] = useState(true);
  const dirtyKey = 'offer-form';
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  useDirty(dirtyKey, dirty, '작성 중인 제안은 사라져요.');
  const set = (patch: Partial<OfferInput>) => setV((p) => ({ ...p, ...patch }));
  const back = () => void navigate({ screen: 'overview', view: 'offers', offerId: editing?.id });

  async function save() {
    const now = new Date().toISOString();
    const out = editing
      ? await execute((d) => updateOffer(d, user.id, editing.id, v, now), () => '제안 조건을 고쳤어요. 받는 사람에게 알림이 가요.')
      : await execute((d) => sendOffer(d, user.id, v, now), () => `제안을 보냈어요. ${v.recipientIds.length}명의 알림함에 도착해요.`);
    if (out.status === 'invalid') {
      setErrors(out.errors);
      const first = ['brand', 'product', 'category', 'description', 'format', 'price', 'uploadOn', 'recipients'].find((k) => out.errors[k]);
      if (first) document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
    } else if (out.status === 'saved') {
      setDirty(dirtyKey, null);
      await navigate({ screen: 'overview', view: 'offers', offerId: out.value.id });
    }
  }

  return (
    <form
      className={ps.group}
      noValidate
      aria-label={editing ? '제안 조건 수정' : '새 광고 제안'}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Breadcrumbs
        items={[
          { label: '광고 제안', onClick: () => void navigate({ screen: 'overview', view: 'offers' }) },
          { label: editing ? '조건 수정' : '새 제안' },
        ]}
      />
      <h2 className={ps.detailTitle}>{editing ? '제안 조건 수정' : '새 광고 제안'}</h2>
      <p className={ps.muted}>저장하면 받는 사람의 알림함에 도착해요. 실제 진행·계약·정산은 플랫폼 밖에서 해요.</p>
      <section className={styles.panel} aria-label="제안 내용">
        <h3 className={styles.panelTitle}>제안 내용</h3>
        <div className={styles.grid}>
          <Field label="브랜드명" error={errors.brand}>
            {(p) => <input {...p} data-field="brand" value={v.brand} onChange={(e) => set({ brand: e.target.value })} />}
          </Field>
          <Field label="제품명" error={errors.product}>
            {(p) => <input {...p} data-field="product" value={v.product} onChange={(e) => set({ product: e.target.value })} />}
          </Field>
          <Field label="카테고리" error={errors.category}>
            {(p) => (
              <select {...p} data-field="category" value={v.category} onChange={(e) => set({ category: e.target.value })}>
                <option value="">고르세요</option>
                {OFFER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <FieldGroup legend="광고 형식" error={errors.format}>
            {() => (
              <div className={choiceStyles.choicesRow}>
                {OFFER_FORMATS.map((f, i) => (
                  <label key={f} className={choiceStyles.choice}>
                    <input type="radio" name="offer-format" data-field={i === 0 ? 'format' : undefined} checked={v.format === f} onChange={() => set({ format: f })} />
                    {PROPOSAL_KIND_LABEL[f]}
                  </label>
                ))}
              </div>
            )}
          </FieldGroup>
          <div className={styles.full}>
            <Field label="제품 설명" error={errors.description} multiline>
              {(p) => <textarea {...p} data-field="description" rows={3} value={v.description} onChange={(e) => set({ description: e.target.value })} />}
            </Field>
          </div>
          <Field label="단가(원)" error={errors.price}>
            {(p) => <input {...p} data-field="price" inputMode="numeric" value={v.price} onChange={(e) => set({ price: e.target.value })} />}
          </Field>
          <Field label="희망 업로드 일자" error={errors.uploadOn} help="한국 시간 기준">
            {(p) => <input {...p} data-field="uploadOn" type="date" min={todayKst()} value={v.uploadOn} onChange={(e) => set({ uploadOn: e.target.value })} />}
          </Field>
          <div className={styles.full}>
            <Field label="비고" optional help="예: ○월 ○일까지 가능">
              {(p) => <input {...p} value={v.note} onChange={(e) => set({ note: e.target.value })} />}
            </Field>
          </div>
          <div className={styles.full}>
            <Field label="내부 메모" optional help="관리자에게만 보여요. 받는 사람 화면에는 나오지 않아요.">
              {(p) => <input {...p} value={v.internalMemo} onChange={(e) => set({ internalMemo: e.target.value })} />}
            </Field>
          </div>
        </div>
      </section>
      {editing ? (
        <p className={styles.lock}>받는 사람은 바꿀 수 없어요. 받는 사람을 바꾸려면 취소하고 새로 보내 주세요.</p>
      ) : (
        <section className={styles.panel} aria-label="받는 사람">
          <h3 className={styles.panelTitle}>받는 사람</h3>
          <FieldGroup legend="누구에게" help="크루원과 크루장을 한 제안에 섞지 않아요. 받는 사람마다 따로 수락·거절해요.">
            {() => (
              <div className={choiceStyles.choicesRow}>
                {(['member', 'leader'] as const).map((t) => (
                  <label key={t} className={choiceStyles.choice}>
                    <input type="radio" name="offer-recipient-type" checked={v.recipientType === t} onChange={() => set({ recipientType: t, recipientIds: [] })} />
                    {t === 'member' ? '크루원 (여러 명 가능)' : '크루장 (여러 명 가능)'}
                  </label>
                ))}
              </div>
            )}
          </FieldGroup>
          <RecipientPicker
            type={v.recipientType}
            category={filterCat && v.category ? v.category : ''}
            onToggleCategory={v.category ? () => setFilterCat((x) => !x) : undefined}
            categoryOn={filterCat}
            categoryName={v.category}
            value={v.recipientIds}
            onChange={(ids) => set({ recipientIds: ids })}
          />
          {errors.recipients && <ErrorBand>{errors.recipients}</ErrorBand>}
          <p className={styles.cap}>{NO_RESPONSE_DAYS}일 동안 응답이 없으면 알림함에서 알려 드려요.</p>
        </section>
      )}
      {errors[FORM_ERROR] && <ErrorBand>{errors[FORM_ERROR]}</ErrorBand>}
      <div className={styles.actions}>
        <Button
          disabled={busy}
          onClick={async () => {
            if (dirty) {
              const go = await confirm({ title: '저장하지 않고 닫을까요?', body: '작성 중인 제안은 사라져요.', stayLabel: '계속 작성', goLabel: '닫기' });
              if (!go) return;
              setDirty(dirtyKey, null);
            }
            back();
          }}
        >
          취소
        </Button>
        <Button type="submit" variant="action" busy={busy}>
          {editing ? '고친 조건 저장' : `제안 보내기 (${v.recipientIds.length}명)`}
        </Button>
      </div>
    </form>
  );
}

function OfferDetail({ offerId }: { offerId: string }) {
  const { data, user, execute, busy, navigate, confirm } = useStore();
  const offer = offerOf(data, offerId)!;
  const now = new Date().toISOString();
  const recs = recipientsOf(data, offer.id);
  const locked = isLocked(data, offer.id);
  const stale = recs.filter((r) => isStale(r, offer, now) && !remindedToday(r, now));
  const forwards = data.offerForwards.filter((f) => f.offerId === offer.id);
  const recommendations = data.offerRecommendations.filter((r) => r.offerId === offer.id);
  const name = (id: string) => getUser(data, id)?.name ?? '';
  const remind = (rid: string) => void execute((d) => remindRecipient(d, user.id, rid, new Date().toISOString()), () => '다시 알렸어요. 받는 사람 알림함에 보여요.');

  const history: { at: string; text: string }[] = [
    { at: offer.createdAt, text: `${name(offer.createdBy)} · 제안 보냄 (${recs.map((r) => name(r.userId)).join(', ')})` },
    ...(offer.updatedAt ? [{ at: offer.updatedAt, text: '조건 수정' }] : []),
    ...recs.flatMap((r) => [
      ...r.reminders.map((at) => ({ at, text: `${name(r.userId)}에게 다시 알림` })),
      ...(r.respondedAt
        ? [
            {
              at: r.respondedAt,
              text: `${name(r.userId)} · ${r.response === 'accepted' ? '수락' : `거절 (${DECLINE_REASON_LABEL[r.declineReason!]}${r.declineNote ? `: ${r.declineNote}` : ''})`}${r.proxyMemberIds?.length ? ` · 진행 크루원 ${r.proxyMemberIds.map(name).join(', ')}` : ''}`,
            },
          ]
        : []),
    ]),
    ...forwards.map((f) => ({ at: f.createdAt, text: `${name(f.leaderId)} 크루장 · ${f.memberIds.map(name).join(', ')}에게 ${withRo(f.channel)} 전달${f.memo ? ` (${f.memo})` : ''}` })),
    ...recommendations.map((r) => ({ at: r.createdAt, text: `${name(r.leaderId)} 크루장 · ${r.memberIds.map(name).join(', ')} 추천` })),
    ...(offer.cancelledAt ? [{ at: offer.cancelledAt, text: `${name(offer.cancelledBy!)} · 제안 취소` }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className={ps.group}>
      <Breadcrumbs items={[{ label: '광고 제안', onClick: () => void navigate({ screen: 'overview', view: 'offers' }) }, { label: `${offer.brand} · ${offer.product}` }]} />
      <div>
        <h2 className={ps.detailTitle}>
          {offer.brand} · {offer.product} {offer.cancelledAt && <span className={styles.pill} data-r="cancelled">취소됨</span>}
        </h2>
        <p className={styles.meta}>
          <OfferTags offer={offer} /> 단가 {won(offer.price)} · {offer.recipientType === 'leader' ? '크루장' : '크루원'}에게 · {formatList(offer.createdAt)} 보냄
        </p>
      </div>
      {stale.map((r) => (
        <div key={r.id} className={styles.callout} role="status">
          <span>
            {name(r.userId)}님이 {NO_RESPONSE_DAYS}일간 답이 없었어요. 다시 알릴까요?
          </span>
          <Button size="sm" variant="action" disabled={busy} onClick={() => remind(r.id)}>
            {name(r.userId)}에게 다시 알림
          </Button>
        </div>
      ))}
      <section className={styles.panel} aria-labelledby="offer-resp-title">
        <h3 className={styles.panelTitle} id="offer-resp-title">
          받는 사람별 응답
        </h3>
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label="받는 사람별 응답">
            <thead>
              <tr>
                <th scope="col">받는 사람</th>
                <th scope="col">응답</th>
                <th scope="col">응답 시각</th>
                <th scope="col">메모</th>
                <th scope="col">
                  <span className="sr-only">행동</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {recs.map((r) => {
                const u = getUser(data, r.userId);
                const memo =
                  r.response === 'declined'
                    ? `${DECLINE_REASON_LABEL[r.declineReason!]}${r.declineNote ? `: ${r.declineNote}` : ''}`
                    : r.proxyMemberIds?.length
                      ? `진행: ${r.proxyMemberIds.map(name).join(', ')}`
                      : r.reminders.length
                        ? `다시 알림 ${r.reminders.length}회`
                        : '-';
                return (
                  <tr key={r.id}>
                    <td>
                      <strong>{u?.name}</strong> · {getCrew(data, u?.crewId ?? null)?.name}
                    </td>
                    <td>
                      <ResponsePill offer={offer} rec={r} now={now} admin />
                    </td>
                    <td>{r.respondedAt ? formatDetail(r.respondedAt) : '-'}</td>
                    <td>{memo}</td>
                    <td>
                      {r.response === 'accepted' && u?.role === 'member' && (
                        <Button size="sm" onClick={() => void navigate({ screen: 'overview', crewId: u.crewId!, memberId: u.id, tab: 'proposals' })}>
                          진행·수익 기록
                        </Button>
                      )}
                      {r.response === 'pending' && !offer.cancelledAt && remindedToday(r, now) && (
                        <Button size="sm" disabled>
                          오늘 다시 알림
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {offer.internalMemo && <InternalNote>{offer.internalMemo}</InternalNote>}
      <div className={styles.cols}>
        <section className={styles.panel} aria-labelledby="offer-edit-title">
          <h3 className={styles.panelTitle} id="offer-edit-title">
            조건 수정 · 취소
          </h3>
          <OfferFacts offer={offer} />
          {locked && !offer.cancelledAt && <p className={styles.lock}>응답한 사람이 있어 조건을 고칠 수 없어요. 바꾸려면 취소하고 새로 보내 주세요.</p>}
          {!offer.cancelledAt && (
            <div className={ps.actions}>
              <Button disabled={busy || locked} onClick={() => void navigate({ screen: 'overview', view: 'offers', offerId: offer.id, offerEdit: true })}>
                조건 수정
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  const go = await confirm({ title: '이 제안을 취소할까요?', body: '받는 사람 모두에게 ‘제안 취소’ 알림이 가고, 기록은 ‘취소됨’으로 남아요.', stayLabel: '그대로 두기', goLabel: '제안 취소' });
                  if (go) await execute((d) => cancelOffer(d, user.id, offer.id, new Date().toISOString()), () => '제안을 취소했어요.');
                }}
              >
                제안 취소
              </Button>
            </div>
          )}
        </section>
        <section className={styles.panel} aria-labelledby="offer-hist-title">
          <h3 className={styles.panelTitle} id="offer-hist-title">
            이력
          </h3>
          <ol className={styles.hist}>
            {history.map((h, i) => (
              <li key={i}>
                {formatList(h.at)} · {h.text}
              </li>
            ))}
          </ol>
        </section>
      </div>
      {recommendations.length > 0 && (
        <section className={styles.panel} aria-labelledby="offer-rec-title">
          <h3 className={styles.panelTitle} id="offer-rec-title">
            크루장 추천
          </h3>
          {recommendations.map((rc) => (
            <RecommendationItem key={rc.id} offer={offer} rc={rc} />
          ))}
        </section>
      )}
    </div>
  );
}

function RecommendationItem({ offer, rc }: { offer: Offer; rc: OfferRecommendation }) {
  const { data, user, execute, busy } = useStore();
  const already = alreadyOffered(data, offer.id);
  const open = rc.memberIds.filter((id) => !already.has(id));
  const [pick, setPick] = useState<string[]>(open);
  const [err, setErr] = useState<string | undefined>();
  const name = (id: string) => getUser(data, id)?.name ?? '';
  return (
    <div className={styles.card} data-dim={rc.archivedAt || open.length === 0 || undefined} aria-label={`${name(rc.leaderId)} 크루장 추천`}>
      <p>
        <strong>{name(rc.leaderId)} 크루장</strong> → {rc.memberIds.map(name).join(', ')} 추천 · “{rc.reason}” · {formatList(rc.createdAt)}
      </p>
      {rc.sentMemberIds.length > 0 && <p className={styles.cap}>보냄: {rc.sentMemberIds.map(name).join(', ')}</p>}
      {rc.archivedAt ? (
        <p className={styles.cap}>보관한 추천이에요.</p>
      ) : open.length === 0 ? (
        <p className={styles.cap}>추천받은 크루원 모두에게 보냈어요.</p>
      ) : (
        <>
          <div className={styles.chips} role="group" aria-label="보낼 크루원">
            {open.map((id) => (
              <label key={id} className={styles.chip}>
                <input type="checkbox" checked={pick.includes(id)} onChange={(e) => setPick(e.target.checked ? [...pick, id] : pick.filter((x) => x !== id))} />
                {name(id)}
              </label>
            ))}
          </div>
          {err && <ErrorBand>{err}</ErrorBand>}
          <div className={ps.actions}>
            <Button
              variant="action"
              disabled={busy || pick.length === 0 || !!offer.cancelledAt}
              onClick={async () => {
                const out = await execute((d) => sendFromRecommendation(d, user.id, rc.id, pick, new Date().toISOString()), () => `${pick.map(name).join(', ')}에게 같은 조건으로 제안을 보냈어요.`);
                if (out.status === 'invalid') setErr(Object.values(out.errors)[0]);
              }}
            >
              고른 크루원에게 이 제안 보내기 ({pick.length}명)
            </Button>
            <Button disabled={busy} onClick={() => void execute((d) => archiveRecommendation(d, user.id, rc.id, new Date().toISOString()), () => '추천을 보관했어요.')}>
              추천 보관
            </Button>
          </div>
          <p className={styles.cap}>관리자가 확인한 뒤 보내요. 추천만으로는 크루원에게 아무것도 가지 않아요.</p>
        </>
      )}
    </div>
  );
}

/**
 * 받는 사람 고르기 (사용자 확정): 크루를 펼쳐 그 크루의 크루원을 고르고, 고른 사람은 아래에 모인다.
 * 크루장에게 보낼 때는 크루를 체크하면 그 크루의 크루장이 선택된다.
 */
function RecipientPicker({
  type,
  category,
  categoryOn,
  categoryName,
  onToggleCategory,
  value,
  onChange,
}: {
  type: 'member' | 'leader';
  category: string;
  categoryOn: boolean;
  categoryName: string;
  onToggleCategory?: () => void;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data, user } = useStore();
  const [open, setOpen] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const allowed = new Set(selectableRecipients(data, user, type).map((u) => u.id));
  const crews = user.managedCrewIds
    .map((id) => getCrew(data, id)!)
    .filter((c) => !!c && (!category || !c.category || c.category === category))
    .filter((c) => !q.trim() || c.name.includes(q.trim()))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const membersOf = (crewId: string) => data.users.filter((u) => u.role === 'member' && u.crewId === crewId && allowed.has(u.id));
  const toggle = (id: string, on: boolean) => onChange(on ? [...new Set([...value, id])] : value.filter((x) => x !== id));
  const picked = value.map((id) => getUser(data, id)).filter(Boolean);
  return (
    <div className={styles.picker} data-field="recipients">
      <div className={styles.pickerBar}>
        {onToggleCategory && (
          <label className={choiceStyles.choice}>
            <input type="checkbox" checked={categoryOn} onChange={onToggleCategory} />
            카테고리 ‘{categoryName}’ 크루만 보기
          </label>
        )}
        <label className={styles.search}>
          <span className="sr-only">크루 검색</span>
          <input type="search" placeholder="크루 이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {crews.length === 0 && <p className={ps.muted}>고를 수 있는 크루가 없어요. 카테고리 거르기를 꺼 보세요.</p>}
      <ul className={styles.crewList} aria-label={type === 'member' ? '크루별 크루원' : '크루별 크루장'}>
        {crews.map((c) => {
          if (type === 'leader') {
            const leader = getUser(data, c.leaderId);
            if (!leader || !allowed.has(leader.id)) return null;
            return (
              <li key={c.id} className={styles.crewRow}>
                <label className={styles.crewHead}>
                  <input type="checkbox" checked={value.includes(leader.id)} onChange={(e) => toggle(leader.id, e.target.checked)} />
                  <span>
                    <strong>{c.name} 크루</strong> · 크루장 {leader.name}
                  </span>
                  {c.category && <span className={styles.cat}>{c.category}</span>}
                </label>
              </li>
            );
          }
          const ms = membersOf(c.id);
          const isOpen = open.includes(c.id);
          const chosen = ms.filter((m) => value.includes(m.id)).length;
          const all = ms.length > 0 && chosen === ms.length;
          return (
            <li key={c.id} className={styles.crewRow}>
              <button
                type="button"
                className={styles.crewToggle}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? open.filter((x) => x !== c.id) : [...open, c.id])}
              >
                <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                <strong>{c.name} 크루</strong>
                <span className={ps.muted}>
                  크루원 {ms.length}명{chosen > 0 ? ` · ${chosen}명 고름` : ''}
                </span>
                {c.category && <span className={styles.cat}>{c.category}</span>}
              </button>
              {isOpen && (
                <div className={styles.crewBody} role="group" aria-label={`${c.name} 크루원`}>
                  <label className={styles.chip}>
                    <input
                      type="checkbox"
                      checked={all}
                      onChange={(e) => onChange(e.target.checked ? [...new Set([...value, ...ms.map((m) => m.id)])] : value.filter((x) => !ms.some((m) => m.id === x)))}
                    />
                    이 크루 전체 선택
                  </label>
                  {ms.map((m) => (
                    <label key={m.id} className={styles.chip}>
                      <input type="checkbox" checked={value.includes(m.id)} onChange={(e) => toggle(m.id, e.target.checked)} />
                      {m.name}
                    </label>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className={styles.picked} aria-live="polite">
        <span className={styles.pickedLabel}>선택한 사람 {picked.length}명</span>
        {picked.map((u) => (
          <span key={u!.id} className={styles.pickedChip}>
            {u!.name}({getCrew(data, u!.crewId)?.name})
            <button type="button" aria-label={`${u!.name} 빼기`} onClick={() => toggle(u!.id, false)}>
              ✕
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
