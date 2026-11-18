import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { canOpen, globalMenu } from '../state/routes';
import { BACKUP_KEY_PREFIX, createMemoryKv, createStorage, DATA_KEY } from '../storage/storage';
import type { CommandResult } from './commands';
import { inboxFor } from './inbox';
import {
  cancelOffer,
  forwardOffer,
  isStale,
  offersReceivedBy,
  recipientsOf,
  recommendMembers,
  remindRecipient,
  respondOffer,
  sendFromRecommendation,
  sendOffer,
  updateOffer,
  type OfferInput,
} from './offers';
import { getUser } from './queries';
import type { AppData } from './types';

const T0 = '2026-11-09T01:00:00.000Z';
const DAY = 24 * 3600_000;
const at = (d: number) => new Date(new Date(T0).getTime() + d * DAY).toISOString();
function must<T>(r: CommandResult<T>) {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
}
const u = (d: AppData, id: string) => getUser(d, id)!;
const BASE: OfferInput = {
  brand: '브랜드',
  product: '제품',
  category: '푸드',
  description: '설명',
  format: 'ad',
  price: '150,000',
  uploadOn: '2026-11-30',
  note: '',
  internalMemo: '단가 협의 가능',
  recipientType: 'member',
  recipientIds: ['user-minji', 'user-junho'],
};

describe('6-B 제안 보내기', () => {
  it('관리자만, 담당 크루 범위, 크루원·크루장을 섞지 않음, 필수 항목 검증', () => {
    const d = createSeed(T0);
    expect(sendOffer(d, 'user-jihun', BASE, T0).ok).toBe(false);
    expect(sendOffer(d, 'user-seoyeon', { ...BASE, recipientIds: ['user-minji', 'user-jihun'] }, T0).ok).toBe(false);
    const bad = sendOffer(d, 'user-seoyeon', { ...BASE, brand: '', price: '-1', format: '', recipientIds: [] }, T0);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['brand', 'format', 'price', 'recipients']);
    const r = must(sendOffer(d, 'user-seoyeon', BASE, T0));
    expect(r.value.price).toBe(150000);
    expect(recipientsOf(r.data, r.value.id).map((x) => x.response)).toEqual(['pending', 'pending']);
    expect(must(sendOffer(d, 'user-seoyeon', { ...BASE, recipientType: 'leader', recipientIds: ['user-jihun', 'user-yujin'] }, T0)).value.recipientType).toBe('leader');
  });

  it('응답 전까지만 수정, 취소는 언제든 (기록 남음), 받는 사람 알림', () => {
    let d = createSeed(T0);
    const o = must(sendOffer(d, 'user-seoyeon', BASE, T0));
    d = o.data;
    d = must(updateOffer(d, 'user-seoyeon', o.value.id, { ...BASE, price: '200000' }, at(0.1))).data;
    expect(inboxFor(d, u(d, 'user-minji'), at(0.2)).map((i) => i.kind)).toEqual(expect.arrayContaining(['offer', 'offer-update']));
    const rid = recipientsOf(d, o.value.id).find((r) => r.userId === 'user-minji')!.id;
    d = must(respondOffer(d, 'user-minji', rid, { response: 'accepted' }, at(0.5))).data;
    expect(updateOffer(d, 'user-seoyeon', o.value.id, { ...BASE, price: '1' }, at(0.6)).ok).toBe(false);
    d = must(cancelOffer(d, 'user-seoyeon', o.value.id, at(0.7))).data;
    expect(d.offers.find((x) => x.id === o.value.id)?.cancelledAt).toBe(at(0.7));
    expect(inboxFor(d, u(d, 'user-junho'), at(0.8)).map((i) => i.kind)).toContain('offer-cancel');
    const jr = recipientsOf(d, o.value.id).find((r) => r.userId === 'user-junho')!.id;
    expect(respondOffer(d, 'user-junho', jr, { response: 'accepted' }, at(0.9)).ok).toBe(false);
  });
});

describe('6-B 응답', () => {
  it('본인만, 수락하면 진행 기록이 생기고 철회 없음, 거절은 사유 필수(기타는 직접 입력)', () => {
    let d = createSeed(T0);
    const o = must(sendOffer(d, 'user-seoyeon', BASE, T0));
    d = o.data;
    const [rm, rj] = recipientsOf(d, o.value.id);
    expect(respondOffer(d, 'user-junho', rm.id, { response: 'accepted' }, at(1)).ok).toBe(false);
    const acc = must(respondOffer(d, 'user-minji', rm.id, { response: 'accepted' }, at(1)));
    d = acc.data;
    const prog = d.proposals.filter((p) => p.offerId === o.value.id);
    expect(prog.map((p) => [p.creatorId, p.status])).toEqual([['user-minji', 'negotiating']]);
    expect(prog[0].internalMemo).toBe('단가 협의 가능');
    expect(respondOffer(d, 'user-minji', rm.id, { response: 'declined', reason: 'price' }, at(2)).ok).toBe(false);
    expect(respondOffer(d, 'user-junho', rj.id, { response: 'declined' }, at(2)).ok).toBe(false);
    expect(respondOffer(d, 'user-junho', rj.id, { response: 'declined', reason: 'other' }, at(2)).ok).toBe(false);
    d = must(respondOffer(d, 'user-junho', rj.id, { response: 'declined', reason: 'other', note: '촬영 장비 수리 중' }, at(2))).data;
    const kinds = inboxFor(d, u(d, 'user-seoyeon'), at(3)).filter((i) => i.kind === 'offer-response').map((i) => i.text);
    expect(kinds.some((t) => t.includes('민지') && t.includes('수락'))).toBe(true);
    expect(kinds.some((t) => t.includes('준호') && t.includes('거절'))).toBe(true);
  });

  it('크루장: 전달·추천·대리 응답은 자기 크루원 여러 명 (0명도 가능), 대리 수락하면 고른 크루원별 진행 기록', () => {
    let d = createSeed(T0);
    const rec = recipientsOf(d, 'offer-2')[0];
    expect(forwardOffer(d, 'user-jihun', 'offer-2', ['user-sora'], '카카오톡', '', at(0)).ok).toBe(false);
    d = must(forwardOffer(d, 'user-jihun', 'offer-2', ['user-minji', 'user-haneul'], '카카오톡', '금요일까지 답', at(0))).data;
    expect(recommendMembers(d, 'user-jihun', 'offer-2', ['user-haneul'], '', at(0)).ok).toBe(false);
    d = must(recommendMembers(d, 'user-jihun', 'offer-2', ['user-haneul', 'user-junho'], '레시피 경험', at(0))).data;
    expect(inboxFor(d, u(d, 'user-seoyeon'), at(0.1)).map((i) => i.kind)).toContain('offer-recommend');
    expect(respondOffer(d, 'user-jihun', rec.id, { response: 'accepted', memberIds: ['user-sora'] }, at(0.2)).ok).toBe(false);
    d = must(respondOffer(d, 'user-jihun', rec.id, { response: 'accepted', memberIds: ['user-minji', 'user-junho'] }, at(0.2))).data;
    expect(d.proposals.filter((p) => p.offerId === 'offer-2').map((p) => p.creatorId).sort()).toEqual(['user-junho', 'user-minji']);
    // 진행 크루원 없이도 대리 응답 가능
    let d2 = createSeed(T0);
    d2 = must(respondOffer(d2, 'user-jihun', rec.id, { response: 'accepted', memberIds: [] }, at(0.2))).data;
    expect(d2.proposals.filter((p) => p.offerId === 'offer-2')).toHaveLength(0);
  });

  it('추천 → 관리자가 고른 크루원에게 같은 조건으로 새 제안 (이미 받은 사람은 빠짐)', () => {
    let d = createSeed(T0);
    const r = must(recommendMembers(d, 'user-jihun', 'offer-2', ['user-haneul', 'user-junho'], '추천', at(0)));
    d = r.data;
    const s1 = must(sendFromRecommendation(d, 'user-seoyeon', r.value.id, ['user-haneul'], at(0.1)));
    d = s1.data;
    expect(s1.value.recipientType).toBe('member');
    expect(s1.value.sourceOfferId).toBe('offer-2');
    expect(s1.value.price).toBe(200000);
    expect(sendFromRecommendation(d, 'user-seoyeon', r.value.id, ['user-haneul'], at(0.2)).ok).toBe(false);
    expect(offersReceivedBy(d, u(d, 'user-haneul')).some((x) => x.offer.id === s1.value.id)).toBe(true);
  });
});

describe('6-B 무응답 다시 알림', () => {
  it('2일 지나면 관리자 알림, 다시 알림은 하루 한 번, 받는 사람 알림함에 표시', () => {
    let d = createSeed(T0);
    const r = recipientsOf(d, 'offer-1').find((x) => x.userId === 'user-minji')!;
    const offer = d.offers.find((o) => o.id === 'offer-1')!;
    expect(isStale(r, offer, T0)).toBe(true); // 예시 제안은 3일 전에 보냄
    expect(inboxFor(d, u(d, 'user-seoyeon'), T0).map((i) => i.kind)).toContain('offer-stale');
    d = must(remindRecipient(d, 'user-seoyeon', r.id, T0)).data;
    expect(remindRecipient(d, 'user-seoyeon', r.id, at(0.1)).ok).toBe(false);
    expect(inboxFor(d, u(d, 'user-minji'), at(0.1)).map((i) => i.kind)).toContain('offer-remind');
    const after = d.offerRecipients.find((x) => x.id === r.id)!;
    expect(isStale(after, offer, at(1))).toBe(false);
    expect(isStale(after, offer, at(2.1))).toBe(true);
    // 새로 보낸 제안은 2일 전에는 다시 알릴 수 없다
    const o = must(sendOffer(d, 'user-seoyeon', BASE, T0));
    const rr = recipientsOf(o.data, o.value.id)[0];
    expect(remindRecipient(o.data, 'user-seoyeon', rr.id, at(1)).ok).toBe(false);
  });
});

describe('6-B 화면 접근·저장 형식', () => {
  it('크루장 메뉴 받은 제안, 다른 사람 제안은 열 수 없음, 크루원에게 간 제안은 크루장에게 안 보임', () => {
    const d = createSeed(T0);
    expect(globalMenu(u(d, 'user-jihun')).items.map((i) => i.label)).toContain('받은 제안');
    expect(canOpen(d, u(d, 'user-jihun'), { screen: 'my-proposals', offerId: 'offer-2' })).toBe(true);
    expect(canOpen(d, u(d, 'user-jihun'), { screen: 'my-proposals', offerId: 'offer-1' })).toBe(false);
    expect(offersReceivedBy(d, u(d, 'user-jihun')).map((x) => x.offer.id)).toEqual(['offer-2']);
    expect(canOpen(d, u(d, 'user-yujin'), { screen: 'my-proposals', offerId: 'offer-2' })).toBe(false);
    expect(canOpen(d, u(d, 'user-seoyeon'), { screen: 'overview', view: 'offers', offerId: 'offer-1' })).toBe(true);
    expect(canOpen(d, u(d, 'user-jihun'), { screen: 'overview', view: 'offers', offerId: 'offer-1' })).toBe(false);
  });

  it('v6 저장값은 제안 기록 배열만 더해 읽고 backup-v6', () => {
    const kv = createMemoryKv();
    const v6 = createSeed(T0) as Partial<AppData>;
    delete v6.offers;
    delete v6.offerRecipients;
    delete v6.offerForwards;
    delete v6.offerRecommendations;
    const raw = JSON.stringify({ schemaVersion: 6, savedAt: T0, data: v6 });
    kv.setItem(DATA_KEY, raw);
    const st = createStorage(kv);
    const loaded = st.load();
    expect(loaded.kind).toBe('ok');
    if (loaded.kind !== 'ok') return;
    expect(loaded.data.offers).toEqual([]);
    expect(loaded.data.proposals.length).toBeGreaterThan(0);
    st.save(loaded.data);
    expect(kv.getItem(`${BACKUP_KEY_PREFIX}6`)).toBe(raw);
  });
});
