/**
 * Trigger a one-shot alice-ingestor deploy without changing persistent service variables.
 * Uses ingest_requests in Postgres for scope; deploy only starts the cron service image.
 */

const RAILWAY_API = "https://backboard.railway.com/graphql/v2";

function requireRailwayConfig(): {
  token: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
} {
  const token = process.env.RAILWAY_API_TOKEN?.trim();
  const projectId = process.env.RAILWAY_PROJECT_ID?.trim();
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID?.trim();
  const serviceId = process.env.RAILWAY_INGESTOR_SERVICE_ID?.trim();
  if (!token || !projectId || !environmentId || !serviceId) {
    throw new Error("railway_not_configured");
  }
  return { token, projectId, environmentId, serviceId };
}

async function railwayGraphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(RAILWAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`railway_http_${res.status}`);
  }
  const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }
  if (!body.data) {
    throw new Error("railway_empty_response");
  }
  return body.data;
}

export async function triggerIngestorDeployment(): Promise<{ deploymentId: string | null }> {
  const { token, environmentId, serviceId } = requireRailwayConfig();
  const mutation = `
    mutation serviceInstanceDeploy($environmentId: String!, $serviceId: String!) {
      serviceInstanceDeploy(environmentId: $environmentId, serviceId: $serviceId)
    }
  `;
  const data = await railwayGraphql<{ serviceInstanceDeploy: string }>(token, mutation, {
    environmentId,
    serviceId,
  });
  return { deploymentId: data.serviceInstanceDeploy ?? null };
}

export function railwayIngestConfigured(): boolean {
  return Boolean(
    process.env.RAILWAY_API_TOKEN?.trim()
    && process.env.RAILWAY_PROJECT_ID?.trim()
    && process.env.RAILWAY_ENVIRONMENT_ID?.trim()
    && process.env.RAILWAY_INGESTOR_SERVICE_ID?.trim(),
  );
}
