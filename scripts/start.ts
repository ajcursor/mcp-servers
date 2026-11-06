/**
 * npm start: run every server in deploy/mcp-servers.yaml locally, without the demo deployer.
 * Each gets PORT from the yaml and its ${VAR} env from this shell.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

interface Entry {
  entry: string;
  port: number;
  env?: Record<string, string>;
}

const root = path.resolve(import.meta.dirname, '..');
const { servers } = parse(readFileSync(path.join(root, 'deploy/mcp-servers.yaml'), 'utf8')) as { servers: Record<string, Entry> };
const fill = (v: string) => v.replace(/\$\{(\w+)\}/g, (_, k: string) => process.env[k] ?? '');

for (const [name, s] of Object.entries(servers)) {
  const env = Object.fromEntries(Object.entries(s.env ?? {}).map(([k, v]) => [k, fill(v)]));
  const child = spawn(process.execPath, ['--import', 'tsx', s.entry], { cwd: root, env: { ...process.env, ...env, PORT: String(s.port) }, stdio: 'inherit' });
  child.on('exit', (code) => console.log(`${name} exited (${code})`));
}
