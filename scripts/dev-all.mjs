#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { platform } from 'node:process';
import { resolveRuntimeTarget, childEnv, isCloudflare, isLocalLike } from './runtime-target.mjs';

const target = resolveRuntimeTarget();
const children = [];
let stopping = false;

function log(...args) {
  console.log('[dev]', ...args);
}

function spawnCommand(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: platform === 'win32',
    env: childEnv(target),
  });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (stopping) return;
    const detail = signal ?? code ?? 0;
    log(`${name} exited (${detail}). Shutting down remaining processes.`);
    shutdown(typeof code === 'number' ? code : 1);
  });
  child.on('error', (err) => {
    if (stopping) return;
    console.error(`[dev] failed to start ${name}:`, err);
    shutdown(1);
  });
  return child;
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode == null) {
      child.kill('SIGINT');
    }
  }
  setTimeout(() => process.exit(code), 200);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

log(`runtime target: ${target}`);

if (isCloudflare(target)) {
  spawnCommand('wasm', 'pnpm', ['run', 'dev:wasm']);
  spawnCommand('cloudflare', 'pnpm', ['dlx', 'wrangler', 'pages', 'dev']);
} else if (isLocalLike(target)) {
  spawnCommand('wasm', 'pnpm', ['run', 'dev:wasm']);
  spawnCommand('server', 'pnpm', ['run', 'dev:server']);
} else {
  log(`unknown runtime target "${target}"; defaulting to local workflow.`);
  spawnCommand('wasm', 'pnpm', ['run', 'dev:wasm']);
  spawnCommand('server', 'pnpm', ['run', 'dev:server']);
}
