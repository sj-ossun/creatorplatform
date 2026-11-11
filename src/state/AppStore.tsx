/**
 * 공유 상태 (React Context). 모든 역할 화면이 같은 원본 데이터를 참조한다.
 * 업무 명령은 commit.ts 를 거쳐 저장 성공 후에만 화면에 확정된다.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { CommandResult } from '../domain/commands';
import { getUser } from '../domain/queries';
import type { AppData, ID, User } from '../domain/types';
import { createSeed } from '../data/seed';
import { markInboxRead } from '../domain/inbox';
import type { Storage } from '../storage/storage';
import { executeCommand, type ExecOutcome } from './commit';
import { canOpen, HOME, isPublic, type LoginReason, type Route } from './routes';
import type { ListFilter } from '../domain/views';

/** 저장 중 상태가 눈에 보이도록 둔 짧은 대기. 실제 저장은 동기 localStorage 다. */
export const SAVE_DELAY_MS = 300;

/**
 * 로그인하지 않았을 때 보호 페이지 컴포넌트가 받는 빈 사용자. 어떤 크루·미션에도 속하지 않는다.
 * 보호 페이지는 Shell 이 session 이 있을 때만 그리므로 실제 화면에는 쓰이지 않는다.
 */
const NO_USER: User = { id: '', name: '', role: 'member', crewId: null, managedCrewIds: [] };

export type LoginResult = { ok: true } | { ok: false; error: string };

export interface ConfirmSpec {
  title: string;
  body: string;
  stayLabel: string;
  goLabel: string;
}

interface DialogState extends ConfirmSpec {
  resolve: (go: boolean) => void;
}

export interface Toast {
  id: number;
  message: string;
}

interface StoreValue {
  data: AppData;
  /** 시연 세션 (N-07): 메모리에만 둔다. 새로고침하면 비로그인으로 시작한다 */
  session: User | null;
  /** 보호 페이지 안에서 쓰는 현재 사용자 (session 이 있을 때만 그 페이지가 그려진다) */
  user: User;
  route: Route;
  /** 비로그인으로 요청했던 보호 페이지 (N-03). 내부 ID 만 담은 화면 상태다 */
  pending: Route | null;
  /** 현재 화면을 이 사용자가 열 수 있는지 */
  routeAllowed: boolean;
  busy: boolean;
  execute<T>(compute: (data: AppData) => CommandResult<T>, successMessage: (value: T) => string): Promise<ExecOutcome<T>>;
  navigate(route: Route): Promise<boolean>;
  /** P-12 시연 로그인. 역할과 계정의 실제 역할이 맞을 때만 로그인하고 언제나 홈으로 간다 */
  login(userId: ID, role: User['role']): LoginResult;
  /** 미저장 입력 확인 후 세션만 해제하고 공개 홈으로. 업무 기록은 그대로다 */
  logout(): Promise<boolean>;
  /** 로그인한 뒤 열 대상을 기억하고 P-12 로 안내한다 (알림의 피드백 연결 등) */
  requireLogin(target: Route, reason: LoginReason): Promise<boolean>;
  clearPending(): void;
  /** 알림함을 연 시각을 조용히 저장한다 (실패해도 화면은 그대로, 알림 없음) */
  markInboxSeen(): void;
  requestReset(): Promise<void>;
  /** 저장하지 않은 입력 등록. body 는 확인 대화상자 본문 (예: 작성 중인 피드백은 사라져요.) */
  setDirty(key: string, body: string | null): void;
  confirm(spec: ConfirmSpec): Promise<boolean>;
  dialog: DialogState | null;
  toast: Toast | null;
  /** 미션 목록 필터. 상세에서 돌아와도 유지하고, 예시 사용자가 바뀌면 해제한다 */
  listFilter: ListFilter;
  setListFilter(f: ListFilter): void;
  /** 저장소 경고 문구 (role=alert) */
  storageWarning: string | null;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('StoreProvider 가 필요합니다');
  return v;
}

export function useDirty(key: string, dirty: boolean, body: string) {
  const { setDirty } = useStore();
  useEffect(() => {
    setDirty(key, dirty ? body : null);
    return () => setDirty(key, null);
  }, [key, dirty, body, setDirty]);
}

export const UNSAVED: ConfirmSpec = {
  title: '저장하지 않고 이동할까요?',
  body: '작성 중인 내용은 사라져요.',
  stayLabel: '계속 작성',
  goLabel: '이동하기',
};

interface ProviderProps {
  storage: Storage;
  initialData: AppData;
  initialStorageWarning?: string | null;
  children: ReactNode;
}

export function StoreProvider({ storage, initialData, initialStorageWarning = null, children }: ProviderProps) {
  const [data, setData] = useState<AppData>(initialData);
  const dataRef = useRef(initialData);
  // 이전 버전이 남긴 예시 사용자 저장값(crew-prototype/session)은 읽지 않는다 (N-07). 지우지도 않는다.
  const [userId, setUserId] = useState<ID | null>(null);
  const session = (userId && getUser(data, userId)) || null;
  const user = session ?? NO_USER;
  const [route, setRoute] = useState<Route>(HOME);
  const [pending, setPending] = useState<Route | null>(null);
  const sessionRef = useRef<User | null>(null);
  sessionRef.current = session;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const dirtyRef = useRef(new Map<string, string>());
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(initialStorageWarning);
  const [listFilter, setListFilter] = useState<ListFilter>('all');

  const showToast = useCallback((message: string) => {
    setToast({ id: Date.now() + Math.random(), message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const confirm = useCallback(
    (spec: ConfirmSpec) =>
      new Promise<boolean>((resolve) => {
        setDialog({
          ...spec,
          resolve: (go) => {
            setDialog(null);
            resolve(go);
          },
        });
      }),
    [],
  );

  const setDirty = useCallback((key: string, body: string | null) => {
    if (body === null) dirtyRef.current.delete(key);
    else dirtyRef.current.set(key, body);
  }, []);

  /** 저장하지 않은 입력이 있으면 확인한다. 취소하면 입력과 초점을 유지한다. */
  const confirmLeave = useCallback(async () => {
    if (dirtyRef.current.size === 0) return true;
    const body = [...dirtyRef.current.values()][0] ?? UNSAVED.body;
    const go = await confirm({ ...UNSAVED, body });
    if (go) dirtyRef.current.clear();
    return go;
  }, [confirm]);

  const navigate = useCallback(
    async (next: Route) => {
      if (busyRef.current) return false;
      if (!(await confirmLeave())) return false;
      if (!sessionRef.current && !isPublic(next)) {
        // 비로그인 보호 페이지 요청: 내용을 보이지 않고 로그인으로 안내한다
        setPending(next);
        setRoute({ screen: 'login', reason: 'protected' });
        return true;
      }
      // 로그인 후 다른 곳으로 이동하면 기억한 목적지는 버린다 (로그인 화면으로 가는 경우는 유지)
      if (sessionRef.current && next.screen !== 'login') setPending(null);
      setRoute(next);
      return true;
    },
    [confirmLeave],
  );

  const login = useCallback(
    (nextUserId: ID, role: User['role']): LoginResult => {
      if (busyRef.current) return { ok: false, error: '저장 중이에요. 잠시 뒤 다시 시도해 주세요.' };
      const nextUser = getUser(dataRef.current, nextUserId);
      if (!nextUserId || !nextUser) return { ok: false, error: '시연 계정을 골라 주세요.' };
      if (nextUser.role !== role) return { ok: false, error: '고른 역할에 속한 계정이 아니에요. 계정을 다시 골라 주세요.' };
      dirtyRef.current.clear();
      setUserId(nextUser.id);
      setListFilter('all');
      setToast(null);
      // 목적지는 새 계정으로 열 수 있을 때만 남긴다 (잘못된 계정이면 제거)
      setPending((p) => (p && canOpen(dataRef.current, nextUser, p) ? p : null));
      setRoute(HOME);
      return { ok: true };
    },
    [],
  );

  const logout = useCallback(async () => {
    if (busyRef.current) return false;
    if (!(await confirmLeave())) return false;
    setUserId(null);
    setPending(null);
    setListFilter('all');
    setRoute(HOME);
    showToast('로그아웃했어요. 저장한 기록은 그대로 남아 있어요.');
    return true;
  }, [confirmLeave, showToast]);

  const requireLogin = useCallback(
    async (target: Route, reason: LoginReason) => {
      if (busyRef.current) return false;
      if (!(await confirmLeave())) return false;
      setPending(target);
      setRoute({ screen: 'login', reason });
      return true;
    },
    [confirmLeave],
  );

  const clearPending = useCallback(() => setPending(null), []);

  const markInboxSeen = useCallback(() => {
    const me = sessionRef.current;
    if (!me || busyRef.current) return;
    const next = markInboxRead(dataRef.current, me.id, new Date().toISOString());
    try {
      storage.save(next);
    } catch {
      return; // 읽음 표시는 업무 기록이 아니다. 저장하지 못하면 다음에 다시 안 읽음으로 보인다
    }
    dataRef.current = next;
    setData(next);
  }, [storage]);

  const execute = useCallback(
    async <T,>(compute: (d: AppData) => CommandResult<T>, successMessage: (v: T) => string) => {
      // 처리 중 가드: 저장이 끝나기 전 같은 명령이 다시 들어오지 않게 한다
      if (busyRef.current) return { status: 'busy' } as ExecOutcome<T>;
      busyRef.current = true;
      setBusy(true);
      try {
        await new Promise((r) => setTimeout(r, SAVE_DELAY_MS));
        const out = executeCommand(dataRef.current, compute, (d) => storage.save(d));
        if (out.status === 'saved') {
          dataRef.current = out.data;
          setData(out.data);
          showToast(successMessage(out.value));
        }
        return out;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [storage, showToast],
  );

  const requestReset = useCallback(async () => {
    if (busyRef.current) return;
    if (!(await confirmLeave())) return;
    const go = await confirm({
      title: '예시 데이터를 처음 상태로 되돌릴까요?',
      body: '등록한 미션과 제출·피드백 기록이 처음 예시로 돌아가요.',
      stayLabel: '계속 사용',
      goLabel: '초기화하기',
    });
    if (!go) return;
    const seed = createSeed(new Date().toISOString());
    try {
      storage.save(seed);
      setStorageWarning(null);
    } catch {
      // 저장하지 못하면 이전 데이터를 그대로 둔다
      setStorageWarning('예시 데이터를 초기화하지 못했어요. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.');
      return;
    }
    dataRef.current = seed;
    setData(seed);
    setListFilter('all');
    setPending(null);
    setRoute(HOME);
    showToast('예시 데이터를 처음 상태로 되돌렸어요.');
  }, [confirm, confirmLeave, storage, showToast]);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      session,
      user,
      route,
      pending,
      routeAllowed: canOpen(data, session, route),
      busy,
      execute,
      navigate,
      login,
      logout,
      requireLogin,
      clearPending,
      markInboxSeen,
      requestReset,
      setDirty,
      confirm,
      dialog,
      toast,
      storageWarning,
      listFilter,
      setListFilter,
    }),
    [data, session, user, route, pending, busy, execute, navigate, login, logout, requireLogin, clearPending, markInboxSeen, requestReset, setDirty, confirm, dialog, toast, storageWarning, listFilter],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
