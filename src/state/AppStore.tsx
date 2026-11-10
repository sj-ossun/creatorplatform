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
import type { Storage } from '../storage/storage';
import { executeCommand, type ExecOutcome } from './commit';
import { canOpen, startRoute, type Route } from './routes';
import type { ListFilter } from '../domain/views';

/** 저장 중 상태가 눈에 보이도록 둔 짧은 대기. 실제 저장은 동기 localStorage 다. */
export const SAVE_DELAY_MS = 300;

export const DEFAULT_USER_ID = 'user-jihun';

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
  user: User;
  route: Route;
  /** 현재 화면을 이 사용자가 열 수 있는지 */
  routeAllowed: boolean;
  busy: boolean;
  execute<T>(compute: (data: AppData) => CommandResult<T>, successMessage: (value: T) => string): Promise<ExecOutcome<T>>;
  navigate(route: Route): Promise<boolean>;
  switchUser(userId: ID, route?: (user: User) => Route): Promise<boolean>;
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
  const [userId, setUserId] = useState<ID>(() => {
    const saved = storage.loadSession()?.currentUserId;
    return saved && getUser(initialData, saved) ? saved : DEFAULT_USER_ID;
  });
  const user = getUser(data, userId) ?? getUser(data, DEFAULT_USER_ID)!;
  const [route, setRoute] = useState<Route>(() => startRoute(user));
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
      setRoute(next);
      return true;
    },
    [confirmLeave],
  );

  const switchUser = useCallback(
    async (nextUserId: ID, routeFor?: (u: User) => Route) => {
      if (busyRef.current) return false;
      const nextUser = getUser(dataRef.current, nextUserId);
      if (!nextUser) return false;
      if (!(await confirmLeave())) return false;
      setUserId(nextUser.id);
      setListFilter('all');
      // 이전 사용자 작업의 저장 알림을 다음 사용자 화면에 남기지 않는다
      setToast(null);
      storage.saveSession({ currentUserId: nextUser.id });
      setRoute(routeFor ? routeFor(nextUser) : startRoute(nextUser));
      return true;
    },
    [confirmLeave, storage],
  );

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
    const u = getUser(seed, userId) ?? getUser(seed, DEFAULT_USER_ID)!;
    setListFilter('all');
    setRoute(startRoute(u));
    showToast('예시 데이터를 처음 상태로 되돌렸어요.');
  }, [confirm, confirmLeave, storage, userId, showToast]);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      user,
      route,
      routeAllowed: canOpen(data, user, route),
      busy,
      execute,
      navigate,
      switchUser,
      requestReset,
      setDirty,
      confirm,
      dialog,
      toast,
      storageWarning,
      listFilter,
      setListFilter,
    }),
    [data, user, route, busy, execute, navigate, switchUser, requestReset, setDirty, confirm, dialog, toast, storageWarning, listFilter],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
