/**
 * Trigger alice-ingestor cron "run now" via Railway GraphQL.
 * `serviceInstanceDeploy` only builds for cron services; execution starts the start command.
 * @see https://docs.railway.com/cron-jobs
 * @see https://station.railway.com/questions/is-it-possible-to-use-the-railway-public-4587fc2b
 */

const RAILWAY_API = "https://backboard.railway.com/graphql/v2";

function requireRailwayConfig(): {
  token: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  serviceInstanceId: string | null;
} {
  const token = process.env.RAILWAY_API_TOKEN?.trim();
  const projectId = process.env.RAILWAY_PROJECT_ID?.trim();
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID?.trim();
  const serviceId = process.env.RAILWAY_INGESTOR_SERVICE_ID?.trim();
  const serviceInstanceId = process.env.RAILWAY_INGESTOR_SERVICE_INSTANCE_ID?.trim() || null;
  if (!token || !projectId || !environmentId || !serviceId) {
    throw new Error("railway_not_configured");
  }
  return { token, projectId, environmentId, serviceId, serviceInstanceId };
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

async function resolveServiceInstanceId(
  token: string,
  environmentId: string,
  serviceId: string,
): Promise<string> {
  const query = `
    query serviceInstanceForEnv($environmentId: String!) {
      environment(id: $environmentId) {
        serviceInstances {
          edges {
            node {
              id
              serviceId
            }
          }
        }
      }
    }
  `;
  const data = await railwayGraphql<{
    environment: {
      serviceInstances: { edges: Array<{ node: { id: string; serviceId: string } }> };
    } | null;
  }>(token, query, { environmentId });

  const match = data.environment?.serviceInstances.edges.find(
    (edge) => edge.node.serviceId === serviceId,
  );
  if (!match?.node.id) {
    throw new Error("railway_service_instance_not_found");
  }
  return match.node.id;
}

export async function triggerIngestorDeployment(): Promise<{
  executionId: string | null;
  serviceInstanceId: string;
}> {
  const { token, environmentId, serviceId, serviceInstanceId: configuredInstanceId } = requireRailwayConfig();
  const serviceInstanceId = configuredInstanceId
    ?? await resolveServiceInstanceId(token, environmentId, serviceId);

  const mutation = `
    mutation deploymentInstanceExecutionCreate($input: DeploymentInstanceExecutionCreateInput!) {
      deploymentInstanceExecutionCreate(input: $input) {
        id
        status
      }
    }
  `;
  const data = await railwayGraphql<{
    deploymentInstanceExecutionCreate: { id: string; status: string } | null;
  }>(token, mutation, {
    input: { serviceInstanceId },
  });

  return {
    executionId: data.deploymentInstanceExecutionCreate?.id ?? null,
    serviceInstanceId,
  };
}

export function railwayIngestConfigured(): boolean {
  return Boolean(
    process.env.RAILWAY_API_TOKEN?.trim()
    && process.env.RAILWAY_PROJECT_ID?.trim()
    && process.env.RAILWAY_ENVIRONMENT_ID?.trim()
    && process.env.RAILWAY_INGESTOR_SERVICE_ID?.trim(),
  );
}
