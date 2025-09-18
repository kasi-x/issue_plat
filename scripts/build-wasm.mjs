#!/usr/bin/env node
import { ensureRustTarget, ensureTrunkAvailable, getWasmPackInvocation, leptosDir, preferTrunk, runSync } from './wasm-utils.mjs';
import { resolveRuntimeTarget } from './runtime-target.mjs';

async function main() {
  const target = resolveRuntimeTarget();
  console.log(`[wasm] build target: ${target}`);
  try {
    ensureRustTarget();
  } catch (err) {
    console.warn('[wasm] skipped rust target setup:', err?.message ?? err);
  }

  let usedTrunk = false;
  if (ensureTrunkAvailable() && preferTrunk()) {
    usedTrunk = true;
    runSync('trunk', ['build', '--dist', '../public/assets'], { cwd: leptosDir });
  }

  if (!usedTrunk) {
    const { command, args } = getWasmPackInvocation({ watch: false });
    runSync(command, args, { cwd: leptosDir });
  }
}

main().catch((err) => {
  console.error('[wasm] build failed:', err);
  process.exit(1);
});
