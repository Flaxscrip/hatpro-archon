// Thin fetch client for the resort keymaster API (server-side resort wallet).
// The console holds no keys — all signing/verification happens behind this API.

export interface VerifyCredential {
  schema: string;
  issuer: string;
  claims: Record<string, any>;
  selfAsserted: boolean;
  issuerAuthorized: boolean;
  trustMessage: string;
}
export interface VerifyResult {
  cryptographicMatch: boolean;
  requested: number;
  fulfilled: number;
  responder: string;
  allIssuersTrusted: boolean;
  accepted: boolean;
  credentials: VerifyCredential[];
}

async function post(base: string, path: string, body: unknown) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

export async function getId(base: string): Promise<{ name: string; did: string }> {
  const res = await fetch(`${base}/id`);
  if (!res.ok) throw new Error(`resort API unreachable (${res.status})`);
  return res.json();
}

export function createRequest(base: string, credentials: { schema: string; issuers?: string[] }[]): Promise<{ challenge: string }> {
  return post(base, '/profile-request', { credentials });
}

export function verify(base: string, response: string): Promise<VerifyResult> {
  return post(base, '/verify', { response });
}
