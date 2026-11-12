import { Button } from '../../components/Button/Button';
import { nudgedToday, pendingTargets, sendNudge } from '../../domain/nudge';
import { getUser } from '../../domain/queries';
import { isAfter } from '../../domain/time';
import type { Mission } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';

/**
 * 크루장 재촉 알림 (6-A): 마감 전 미제출자에게 앱 안 알림을 보낸다. 같은 미션에 하루 한 번. 외부 발송 없음.
 * 마감 24시간 전부터는 크루원 알림함에 '마감 임박'이 자동으로 보인다.
 */
export function NudgeBox({ mission }: { mission: Mission }) {
  const { data, user, execute, busy } = useStore();
  const now = new Date().toISOString();
  if (isAfter(now, mission.dueAt)) return null;
  const pending = pendingTargets(data, mission);
  if (pending.length === 0) return null;
  const sent = nudgedToday(data, mission.id, now);
  const names = pending.map((id) => getUser(data, id)?.name).join(', ');
  return (
    <section className={`${ps.panelPad} ${ps.reviewEntry}`} aria-labelledby="nudge-title">
      <div>
        <h2 className={ps.sectionTitle} id="nudge-title">
          아직 제출하지 않은 크루원 {pending.length}명
        </h2>
        <p className={ps.muted}>
          {names} · 재촉 알림은 크루원 알림함에만 보이고 외부로 보내지 않아요. 같은 미션에는 하루 한 번 보낼 수 있어요.
        </p>
      </div>
      <Button
        disabled={busy || sent}
        onClick={() => void execute((d) => sendNudge(d, user.id, mission.id, new Date().toISOString()), (n) => `${n.memberIds.length}명에게 재촉 알림을 보냈어요.`)}
      >
        {sent ? '오늘 보냈어요' : '재촉 알림 보내기'}
      </Button>
    </section>
  );
}
