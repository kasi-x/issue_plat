import { spawn, spawnSync } from 'node:child_process';
import { platform } from 'node:process';
import { resolve } from 'node:path';

export const projectRoot = resolve(process.cwd());
export const leptosDir = resolve(projectRoot, 'leptos-app');

export function commandExists(cmd) {
  const which = platform === 'win32' ? 'where' : 'which';
  const res = spawnSync(which, [cmd], { stdio: 'ignore' });
  return res.status === 0;
}

export function ensureRustTarget(target = 'wasm32-unknown-unknown') {
  if (!commandExists('rustup')) return;
  const list = spawnSync('rustup', ['target', 'list', '--installed'], { encoding: 'utf8' });
  if (list.status !== 0) return;
  if (!list.stdout?.split(/\s+/).includes(target)) {
    const add = spawnSync('rustup', ['target', 'add', target], { stdio: 'inherit' });
    if (add.status !== 0) {
      throw new Error(`Failed to add rustup target ${target}`);
    }
  }
}

export function runSync(command, args, opts = {}) {
  const res = spawnSync(command, args, { stdio: 'inherit', ...opts });
  if (res.status !== 0) {
    const code = typeof res.status === 'number' ? res.status : 1;
    process.exit(code);
  }
}

export function spawnStreaming(command, args, opts = {}) {
  const child = spawn(command, args, { stdio: 'inherit', ...opts });
  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
  child.on('error', (err) => {
    console.error(`[wasm] failed to start ${command}:`, err);
    process.exit(1);
  });
  return child;
}

export function getWasmPackInvocation({ watch = false } = {}) {
  const baseArgs = ['build', '--target', 'web', '--out-dir', '../public/assets', '--out-name', 'app'];
  if (watch) baseArgs.push('--watch');
  if (commandExists('wasm-pack')) {
    return { command: 'wasm-pack', args: baseArgs };
  }
  const pnpmCmd = commandExists('pnpm') ? 'pnpm' : null;
  if (!pnpmCmd) {
    throw new Error('Neither wasm-pack nor pnpm (for pnpm dlx wasm-pack) is available in PATH.');
  }
  return { command: pnpmCmd, args: ['dlx', 'wasm-pack', ...baseArgs] };
}

export function preferTrunk() {
  return commandExists('trunk');
}

export function ensureTrunkAvailable() {
  if (preferTrunk()) return true;
  if (!commandExists('cargo')) return false;
  console.log('[wasm] trunk not found; installing via `cargo install trunk`...');
  const install = spawnSync('cargo', ['install', 'trunk'], { stdio: 'inherit' });
  return install.status === 0;
}
