/**
 * 중앙 명령 처리 (명세 11.2, 디자인 14장).
 * 검증 → 다음 데이터 전체 저장 → 저장 성공 시에만 화면 확정.
 * 저장에 실패하면 이전 데이터를 그대로 두고, 호출한 화면은 입력을 유지한다.
 */
import type { CommandResult, FieldErrors } from '../domain/commands';
import type { AppData } from '../domain/types';

export type ExecOutcome<T> =
  | { status: 'saved'; data: AppData; value: T }
  | { status: 'invalid'; errors: FieldErrors }
  | { status: 'save_failed' }
  | { status: 'busy' };

export function executeCommand<T>(
  current: AppData,
  compute: (data: AppData) => CommandResult<T>,
  save: (data: AppData) => void,
): ExecOutcome<T> {
  const result = compute(current);
  if (!result.ok) return { status: 'invalid', errors: result.errors };
  try {
    save(result.data);
  } catch {
    return { status: 'save_failed' };
  }
  return { status: 'saved', data: result.data, value: result.value };
}
