import assert from "node:assert/strict";
import test from "node:test";
import {
  DEPLOYMENT_INSTANCE_EXECUTION_CREATE_MUTATION,
  railwayAuthHeaders,
  railwayTokenType,
} from "../../apps/web/src/lib/railway-ingest.ts";

test("railwayAuthHeaders uses Project-Access-Token by default", () => {
  const prev = process.env.RAILWAY_TOKEN_TYPE;
  delete process.env.RAILWAY_TOKEN_TYPE;
  assert.deepEqual(railwayAuthHeaders("secret-token", "project"), {
    "Project-Access-Token": "secret-token",
  });
  if (prev !== undefined) process.env.RAILWAY_TOKEN_TYPE = prev;
});

test("railwayAuthHeaders uses Authorization Bearer when type is bearer", () => {
  assert.deepEqual(railwayAuthHeaders("account-token", "bearer"), {
    Authorization: "Bearer account-token",
  });
});

test("deploymentInstanceExecutionCreate mutation has no selection set (Boolean!)", () => {
  const fieldLine = DEPLOYMENT_INSTANCE_EXECUTION_CREATE_MUTATION
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("deploymentInstanceExecutionCreate(input:"));
  assert.ok(fieldLine, "expected field call line in mutation");
  assert.equal(fieldLine, "deploymentInstanceExecutionCreate(input: $input)");
  assert.match(DEPLOYMENT_INSTANCE_EXECUTION_CREATE_MUTATION, /DeploymentInstanceExecutionCreateInput!/);
});

test("railwayTokenType reads RAILWAY_TOKEN_TYPE", () => {
  const prev = process.env.RAILWAY_TOKEN_TYPE;
  process.env.RAILWAY_TOKEN_TYPE = "bearer";
  assert.equal(railwayTokenType(), "bearer");
  process.env.RAILWAY_TOKEN_TYPE = "project";
  assert.equal(railwayTokenType(), "project");
  process.env.RAILWAY_TOKEN_TYPE = "invalid";
  assert.equal(railwayTokenType(), "project");
  if (prev === undefined) delete process.env.RAILWAY_TOKEN_TYPE;
  else process.env.RAILWAY_TOKEN_TYPE = prev;
});
