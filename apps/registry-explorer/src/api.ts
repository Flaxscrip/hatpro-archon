// Thin client for the ToIP TRQP v2.0 trust-registry server.

export interface Metadata {
  registry_id: string;
  authority_id: string;
  name: string;
  description: string;
  trqp_version: string;
  supported_query_types: string[];
  supported_actions: string[];
}

export interface AuthorizationResult {
  entity_id: string;
  authority_id: string;
  action: string;
  resource: string | null;
  authorized: boolean;
  message: string;
}

export interface AuthorizationQuery {
  authority_id: string;
  entity_id: string;
  action: string;
  resource?: string;
}

export async function getMetadata(base: string): Promise<Metadata> {
  const res = await fetch(`${base}/metadata`);
  if (!res.ok) throw new Error(`trust registry unreachable (${res.status})`);
  return res.json();
}

export async function authorize(base: string, q: AuthorizationQuery): Promise<AuthorizationResult> {
  const res = await fetch(`${base}/authorization`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}
