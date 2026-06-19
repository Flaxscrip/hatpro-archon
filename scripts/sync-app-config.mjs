#!/usr/bin/env node
/**
 * Copies config/demo.json into an app's public/ dir so the browser app can fetch it
 * at runtime. Run automatically by each app's `npm run dev`. Usage:
 *   node scripts/sync-app-config.mjs <app-name>
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = process.argv[2];
if (!app) { console.error('usage: sync-app-config.mjs <app-name>'); process.exit(1); }

const src = join(ROOT, 'config', 'demo.json');
if (!existsSync(src)) { console.error('config/demo.json not found — run `npm run provision` first'); process.exit(1); }

const destDir = join(ROOT, 'apps', app, 'public');
mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, 'demo.json'));
console.log(`synced demo.json -> apps/${app}/public/demo.json`);
