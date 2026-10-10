/**
 * Trigger alice-ingestor cron "run now" via Railway GraphQL.
 * Project tokens: https://docs.railway.com/integrations/api (Project-Access-Token header).
 * Cron run-now: deploymentInstanceExecutionCreate (see Railway Station / manage deployments).
 */

const RAILWAY_API = "https://backboard.railway.com/graphql/v2";

export type RailwayTokenType = "project" | "bearer";

export function railwayTokenType(): RailwayTokenType {
  const raw = (process.env.RAILWAY_TOKEN_TYPE ?? "project").trim().toLowerCase();
  if (raw === "bearer") return "bearer";
  return "project";
}

/** Build auth headers for Railway GraphQL (no token value in logs). */
export function railwayAuthHeaders(token: string, tokenType: RailwayTokenType = railwayTokenType()): Record<string, string> {
  if (tokenType === "bearer") {
    return { Authorization: `Bearer ${token}` };
  }
  return { "Project-Access-Token": token };
}

export class RailwayApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = "RailwayApiError";
  }
}

function requireRailwayConfig(): {
  token: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  serviceInstanceId: string | null;
  tokenType: RailwayTokenType;
} {
  const token = process.env.RAILWAY_API_TOKEN?.trim();
  const projectId = process.env.RAILWAY_PROJECT_ID?.trim();
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID?.trim();
  const serviceId = process.env.RAILWAY_INGESTOR_SERVICE_ID?.trim();
  const serviceInstanceId = process.env.RAILWAY_INGESTOR_SERVICE_INSTANCE_ID?.trim() || null;
  if (!token || !projectId || !environmentId || !serviceId) {
    throw new Error("railway_not_configured");
  }
  return { token, projectId, environmentId, serviceId, serviceInstanceId, tokenType: railwayTokenType() };
}

async function parseRailwayResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: { data?: T; errors?: Array<{ message: string }> } | null = null;
  try {
    body = text ? (JSON.parse(text) as { data?: T; errors?: Array<{ message: string }> }) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const graphqlMsg = body?.errors?.map((e) => e.message).filter(Boolean).join("; ");
    const message = graphqlMsg || text.trim() || `Railway HTTP ${res.status}`;
    throw new RailwayApiError(message, res.status);
  }

  if (body?.errors?.length) {
    throw new RailwayApiError(body.errors.map((e) => e.message).join("; "), res.status);
  }
  if (!body?.data) {
    throw new RailwayApiError("railway_empty_response", res.status);
  }
  return body.data;
}

async function railwayGraphql<T>(
  token: string,
  tokenType: RailwayTokenType,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(RAILWAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...railwayAuthHeaders(token, tokenType),
    },
    body: JSON.stringify({ query, variables }),
  });
  return parseRailwayResponse<T>(res);
}

/**
 * Resolve ingestor service instance id in the configured environment.
 * Uses `environment.serviceInstances` (same GraphQL surface as deployment automation).
 */
async function resolveServiceInstanceId(
  token: string,
  tokenType: RailwayTokenType,
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
  }>(token, tokenType, query, { environmentId });

  const match = data.environment?.serviceInstances.edges.find(
    (edge) => edge.node.serviceId === serviceId,
  );
  if (!match?.node.id) {
    throw new RailwayApiError("railway_service_instance_not_found", null);
  }
  return match.node.id;
}

export async function triggerIngestorDeployment(): Promise<{
  executionId: string | null;
  serviceInstanceId: string;
}> {
  const {
    token,
    environmentId,
    serviceId,
    serviceInstanceId: configuredInstanceId,
    tokenType,
  } = requireRailwayConfig();
  const serviceInstanceId = configuredInstanceId
    ?? await resolveServiceInstanceId(token, tokenType, environmentId, serviceId);

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
  }>(token, tokenType, mutation, {
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
