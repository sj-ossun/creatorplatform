import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button/Button';
import { choiceStyles } from '../../components/Field/Field';
import { getCrew } from '../../domain/queries';
import { ROLE_LABEL, type AppData, type Role, type User } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import { HOME, type LoginReason, type Route } from '../../state/routes';
import styles from './Public.module.css';

const ROLES: { role: Role; desc: string }[] = [
  { role: 'member', desc: '배정된 미션을 제출하고 피드백을 반영해요' },
  { role: 'leader', desc: '미션을 등록하고 제출물을 검토해요' },
  { role: 'admin', desc: '담당 크루의 현황과 개인 활동을 조회해요' },
];

/** 로그인 안내 문구. 대상의 이름·미션 제목은 넣지 않는다 (N-03) */
const REASON_TEXT: Record<LoginReason, string> = {
  protected: '로그인이 필요한 화면이에요. 로그인하면 홈에서 선택했던 화면으로 이동할 수 있어요.',
  crew: '크루 활동은 로그인한 크루원·크루장이 이용해요. 로그인하면 내 크루로 바로 갈 수 있어요.',
  feedback:
    '알림의 피드백은 받는 사람 계정으로 로그인해야 열 수 있어요. 해당 계정으로 로그인하면 홈에 ‘선택했던 피드백 보기’가 보여요.',
  switch: '다른 계정을 고르면 지금 계정 대신 새 계정으로 홈에 돌아가요. 취소하면 지금 계정과 화면을 그대로 유지해요.',
};

function accountSummary(data: AppData, u: User) {
  if (u.role === 'admin') {
    return `담당 크루: ${u.managedCrewIds.map((id) => getCrew(data, id)?.name).join(', ')}`;
  }
  const crew = getCrew(data, u.crewId);
  return crew ? `소속: ${crew.name} 크루 (${ROLE_LABEL[u.role]})` : '소속 크루 없음';
}

/**
 * P-12 시연 로그인 (v0.6 02 4장, N-02). 사전 등록 가상 계정만 고른다. 실제 비밀번호·가입·복구 기능은 없다.
 * 역할 선택은 그 역할의 계정만 보여주는 UI이고, 실제 역할은 계정 기록에서 가져온다.
 * 성공하면 역할과 관계없이 홈(P-01)으로 간다.
 */
export function LoginPage({ route }: { route: Extract<Route, { screen: 'login' }> }) {
  const { data, session, login, navigate, clearPending } = useStore();
  const [role, setRole] = useState<Role>('member');
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const accounts = data.users.filter((u) => u.role === role);
  const selected = accounts.find((u) => u.id === accountId) ?? null;

  useEffect(() => {
    setError(null);
  }, [role, accountId]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const out = login(accountId, role);
    if (!out.ok) {
      setError(out.error);
      selectRef.current?.focus();
    }
  };

  const cancel = async () => {
    clearPending();
    await navigate(route.from ?? HOME);
  };

  return (
    <div className={styles.loginWrap}>
      <form className={styles.loginCard} onSubmit={submit} noValidate aria-labelledby="login-title">
        <div className={styles.loginHead}>
          <h1 className={styles.pageTitle} id="login-title">
            로그인
          </h1>
          <p className={styles.lead2}>시연용 가상 계정이에요. 실제 비밀번호를 입력하지 않아요.</p>
        </div>

        {route.reason && <p className={styles.notice}>{REASON_TEXT[route.reason]}</p>}
        {session && (
          <p className={styles.small}>
            지금 계정: {session.name} · {ROLE_LABEL[session.role]}
          </p>
        )}

        <fieldset className={styles.roleGroup}>
          <legend className={choiceStyles.label}>역할</legend>
          <div className={styles.roles}>
            {ROLES.map((r) => (
              <label key={r.role} className={styles.roleOption}>
                <input
                  type="radio"
                  name="demo-role"
                  value={r.role}
                  checked={role === r.role}
                  onChange={() => {
                    setRole(r.role);
                    setAccountId('');
                  }}
                />
                <span className={styles.roleText}>
                  <span className={styles.roleName}>{ROLE_LABEL[r.role]}</span>
                  <span className={styles.roleDesc}>{r.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={choiceStyles.field}>
          <label className={choiceStyles.label} htmlFor="demo-account">
            시연 계정
          </label>
          <select
            ref={selectRef}
            id="demo-account"
            className={`${choiceStyles.input} ${error ? choiceStyles.invalid : ''}`}
            value={accountId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'demo-account-error' : 'demo-account-summary'}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">{ROLE_LABEL[role]} 계정을 골라 주세요</option>
            {accounts.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role === 'admin' ? '관리자' : (getCrew(data, u.crewId)?.name ?? '소속 없음')})
              </option>
            ))}
          </select>
          {error && (
            <p className={choiceStyles.error} id="demo-account-error">
              <span className={choiceStyles.errorMark} aria-hidden="true">
                !
              </span>
              {error}
            </p>
          )}
          <p className={choiceStyles.help} id="demo-account-summary">
            {selected ? `${selected.name} · ${ROLE_LABEL[selected.role]} · ${accountSummary(data, selected)}` : '역할과 소속은 계정에 미리 정해져 있어요.'}
          </p>
        </div>

        <div className={styles.loginActions}>
          <Button onClick={() => void cancel()}>취소</Button>
          <Button type="submit" variant="action">
            시연 로그인
          </Button>
        </div>
      </form>
    </div>
  );
}
