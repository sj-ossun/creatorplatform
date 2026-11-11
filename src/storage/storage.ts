/**
 * 하나의 저장 어댑터 (명세 11.1).
 * 이 앱의 키만 읽고 쓴다. 다른 앱의 저장소를 지우지 않는다.
 * 호환되지 않는 저장 버전은 자동 삭제하지 않는다.
 */
import type { AppData, ID } from '../domain/types';

/** 데이터 저장 형식 버전. 문서 버전(v0.3)과 별개다. */
export const SCHEMA_VERSION = 4;

export const DATA_KEY = 'crew-prototype/data';
export const SESSION_KEY = 'crew-prototype/session';
/** 형식을 올려 처음 저장하기 직전에 원래 저장값을 한 번 복사해 두는 곳 (복구용) */
export const BACKUP_KEY_PREFIX = 'crew-prototype/backup-v';

interface StoredData {
  schemaVersion: number;
  savedAt: string;
  data: AppData;
}

export interface SessionPrefs {
  currentUserId: ID;
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; data: AppData }
  | { kind: 'incompatible'; foundVersion: unknown }
  | { kind: 'unreadable' };

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Storage {
  load(): LoadResult;
  /** 실패하면 예외를 던진다. 호출한 쪽은 화면 상태를 확정하지 않는다. */
  save(data: AppData): void;
  loadSession(): SessionPrefs | null;
  saveSession(prefs: SessionPrefs): void;
}

const V1_KEYS = ['users', 'crews', 'missions', 'deliverables', 'versions', 'feedbacks', 'notifications'];
const V2_KEYS = [...V1_KEYS, 'posts', 'observations', 'proposals'];
const V3_KEYS = [...V2_KEYS, 'communityPosts', 'comments'];

function hasShape(v: unknown, keys: string[]): v is Record<string, unknown> {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return typeof d.seededAt === 'string' && typeof d.seq === 'number' && keys.every((k) => Array.isArray(d[k]));
}

function isAppData(v: unknown): v is AppData {
  if (!hasShape(v, V3_KEYS)) return false;
  const d = v as Record<string, unknown>;
  return Array.isArray(d.showcases) && !!d.readMarks && typeof d.readMarks === 'object';
}

/** v4 에서 더한 기록: 우수 사례·알림 읽음 시각 */
const V4_ADDITIONS = () => ({ showcases: [], readMarks: {} });

/**
 * 이전 묶음의 저장값은 지우지 않고, 뒤 묶음에서 생긴 기록 배열만 빈 값으로 더해 그대로 쓴다.
 * v1(1차) → posts·observations·proposals·communityPosts·comments 추가
 * v2(2차) → communityPosts·comments 추가
 * 다음 저장 때 현재 형식으로 기록된다.
 */
function migrate(stored: Partial<StoredData>): AppData | null {
  const d = stored.data as unknown as Record<string, unknown>;
  if (stored.schemaVersion === 1 && hasShape(d, V1_KEYS)) {
    return { ...(d as unknown as AppData), posts: [], observations: [], proposals: [], communityPosts: [], comments: [], ...V4_ADDITIONS() };
  }
  if (stored.schemaVersion === 2 && hasShape(d, V2_KEYS)) {
    return { ...(d as unknown as AppData), communityPosts: [], comments: [], ...V4_ADDITIONS() };
  }
  // v3(3차~v0.6 4단계) → 우수 사례·알림 읽음 시각만 더한다
  if (stored.schemaVersion === 3 && hasShape(d, V3_KEYS)) {
    return { ...(d as unknown as AppData), ...V4_ADDITIONS() };
  }
  return null;
}

export function createStorage(kv: KeyValueStore): Storage {
  return {
    load() {
      let raw: string | null;
      try {
        raw = kv.getItem(DATA_KEY);
      } catch {
        return { kind: 'unreadable' };
      }
      if (raw === null) return { kind: 'empty' };
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { kind: 'unreadable' };
      }
      const stored = parsed as Partial<StoredData>;
      const migrated = stored ? migrate(stored) : null;
      if (migrated) return { kind: 'ok', data: migrated };
      if (!stored || stored.schemaVersion !== SCHEMA_VERSION) {
        return { kind: 'incompatible', foundVersion: stored?.schemaVersion };
      }
      if (!isAppData(stored.data)) return { kind: 'unreadable' };
      return { kind: 'ok', data: stored.data };
    },
    save(data) {
      // 이전 형식 저장값이 남아 있으면 덮어쓰기 전에 한 번 백업한다 (이미 백업이 있으면 그대로 둔다)
      try {
        const prev = kv.getItem(DATA_KEY);
        if (prev) {
          const v = (JSON.parse(prev) as Partial<StoredData>).schemaVersion;
          if (typeof v === 'number' && v < SCHEMA_VERSION) {
            const key = `${BACKUP_KEY_PREFIX}${v}`;
            if (kv.getItem(key) === null) kv.setItem(key, prev);
          }
        }
      } catch {
        // 백업은 보조 장치다. 실패해도 본 저장은 진행한다
      }
      const stored: StoredData = { schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), data };
      kv.setItem(DATA_KEY, JSON.stringify(stored));
    },
    loadSession() {
      try {
        const raw = kv.getItem(SESSION_KEY);
        if (!raw) return null;
        const v = JSON.parse(raw) as Partial<SessionPrefs>;
        return typeof v.currentUserId === 'string' ? { currentUserId: v.currentUserId } : null;
      } catch {
        return null;
      }
    },
    saveSession(prefs) {
      try {
        kv.setItem(SESSION_KEY, JSON.stringify(prefs));
      } catch {
        // 예시 사용자 선택은 업무 기록이 아니다. 저장하지 못해도 화면은 계속 쓴다.
      }
    },
  };
}

/** 메모리 저장소 (테스트용). failWrites 로 저장 실패를 흉내 낸다. */
export function createMemoryKv(): KeyValueStore & { failWrites: boolean; dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    failWrites: false,
    getItem: (k) => map.get(k) ?? null,
    setItem(k, v) {
      if (this.failWrites) throw new Error('QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}
