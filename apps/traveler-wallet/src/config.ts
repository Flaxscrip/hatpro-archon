// Runtime demo config, fetched from /demo.json (synced from config/demo.json at dev start).

export interface DemoConfig {
  node: string;
  registry: string;
  schemas: { hatproProfile: string; over18: string; loyaltyTier: string };
  identities: Record<string, string>;
  groups: { admin: string; member: string };
  credentials: { over18: string; loyaltyTier: string };
  seeds: Record<string, string>;
}

export interface AppConfig extends DemoConfig {
  gatekeeperUrl: string;
  issuerApiUrl: string;
}

// Shared demo passphrase used to encrypt the in-browser WalletWeb store (demo only).
export const WALLET_PASSPHRASE = 'hatpro-traveler-demo';

export async function loadConfig(): Promise<AppConfig> {
  const res = await fetch('demo.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('demo.json not found — run `npm run provision` then restart the app');
  const demo: DemoConfig = await res.json();
  const gatekeeperUrl = (import.meta.env.VITE_GATEKEEPER_URL as string) || demo.node;
  const issuerApiUrl = (import.meta.env.VITE_ISSUER_API_URL as string) || 'http://localhost:4327';
  return { ...demo, gatekeeperUrl, issuerApiUrl };
}
