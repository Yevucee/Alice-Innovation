import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendStoppedReason,
  createSourceFailureCircuit,
  recordSourceItemFailure,
  recordSourceItemSuccess,
  SOURCE_FAILURE_CIRCUIT_CONSECUTIVE,
  SOURCE_FAILURE_CIRCUIT_MIN_ITEMS,
} from "../../apps/ingestor/src/source-failure-circuit.ts";

test("stops after consecutive failures", () => {
  const circuit = createSourceFailureCircuit();
  for (let i = 0; i < SOURCE_FAILURE_CIRCUIT_CONSECUTIVE; i += 1) {
    recordSourceItemFailure(circuit, { itemsProcessed: i + 1, failed: i + 1 });
  }
  assert.match(circuit.stoppedReason ?? "", /consecutive_failures/);
});

test("resets consecutive failures on success", () => {
  const circuit = createSourceFailureCircuit();
  for (let i = 0; i < SOURCE_FAILURE_CIRCUIT_CONSECUTIVE - 1; i += 1) {
    recordSourceItemFailure(circuit, { itemsProcessed: i + 1, failed: i + 1 });
  }
  recordSourceItemSuccess(circuit);
  recordSourceItemFailure(circuit, { itemsProcessed: 10, failed: 1 });
  assert.equal(circuit.stoppedReason, null);
});

test("stops on high failure rate after minimum items", () => {
  const circuit = createSourceFailureCircuit();
  const n = SOURCE_FAILURE_CIRCUIT_MIN_ITEMS;
  const failed = Math.floor(n / 2) + 1;
  for (let i = 0; i < n; i += 1) {
    if (i < failed) recordSourceItemFailure(circuit, { itemsProcessed: i + 1, failed: i + 1 });
    else recordSourceItemSuccess(circuit);
  }
  assert.match(circuit.stoppedReason ?? "", /failure_rate/);
});

test("appendStoppedReason adds outcome suffix", () => {
  const out = appendStoppedReason("ran:discovered=1", "circuit:consecutive_failures=25");
  assert.match(out, /stopped_reason=circuit:consecutive_failures=25/);
});
