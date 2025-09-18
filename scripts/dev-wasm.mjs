#!/usr/bin/env node
import { ensureRustTarget, ensureTrunkAvailable, getWasmPackInvocation, leptosDir, preferTrunk, spawnStreaming } from './wasm-utils.mjs';
import { resolveRuntimeTarget } from './runtime-target.mjs';

function start() {
  const target = resolveRuntimeTarget();
  console.log(`[wasm] runtime target: ${target}`);
  try {
    ensureRustTarget();
  } catch (err) {
    console.warn('[wasm] skipped rust target setup:', err?.message ?? err);
  }

  if (ensureTrunkAvailable() && preferTrunk()) {
    console.log('[wasm] running `trunk watch --dist ../public/assets`');
    spawnStreaming('trunk', ['watch', '--dist', '../public/assets'], { cwd: leptosDir });
    return;
  }

  const { command, args } = getWasmPackInvocation({ watch: true });
  console.log('[wasm] running', command, args.join(' '));
  spawnStreaming(command, args, { cwd: leptosDir, shell: command === 'pnpm' });
}

start();
