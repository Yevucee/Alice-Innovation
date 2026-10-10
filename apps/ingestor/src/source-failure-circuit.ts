/** Stop processing a source when failures would starve the global ingest budget. */
export const SOURCE_FAILURE_CIRCUIT_CONSECUTIVE = 25;
export const SOURCE_FAILURE_CIRCUIT_MIN_ITEMS = 50;
export const SOURCE_FAILURE_CIRCUIT_RATE = 0.5;

export type SourceFailureCircuitState = {
  consecutiveFailures: number;
  stoppedReason: string | null;
};

export function createSourceFailureCircuit(): SourceFailureCircuitState {
  return { consecutiveFailures: 0, stoppedReason: null };
}

export function recordSourceItemSuccess(state: SourceFailureCircuitState): void {
  state.consecutiveFailures = 0;
}

export function recordSourceItemFailure(
  state: SourceFailureCircuitState,
  input: { itemsProcessed: number; failed: number },
): void {
  state.consecutiveFailures += 1;
  if (state.stoppedReason) return;
  if (state.consecutiveFailures >= SOURCE_FAILURE_CIRCUIT_CONSECUTIVE) {
    state.stoppedReason = `circuit:consecutive_failures=${state.consecutiveFailures}`;
    return;
  }
  if (
    input.itemsProcessed >= SOURCE_FAILURE_CIRCUIT_MIN_ITEMS
    && input.failed / input.itemsProcessed > SOURCE_FAILURE_CIRCUIT_RATE
  ) {
    state.stoppedReason = `circuit:failure_rate=${input.failed}/${input.itemsProcessed}`;
  }
}

export function appendStoppedReason(outcome: string, stoppedReason: string | null): string {
  if (!stoppedReason) return outcome;
  return `${outcome};stopped_reason=${stoppedReason}`;
}
