const TARGET_ALIASES = new Map([
  ['cloudflare', 'cloudflare'],
  ['cf', 'cloudflare'],
  ['pages', 'cloudflare'],
  ['cloud', 'cloudflare'],
  ['local', 'local'],
  ['native', 'local'],
  ['dev', 'local'],
  ['docker', 'docker'],
  ['container', 'docker'],
]);

function normalize(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  return TARGET_ALIASES.get(key) ?? key;
}

export function resolveRuntimeTarget(argv = process.argv.slice(2)) {
  let raw = null;
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part) continue;
    if (part.startsWith('--target=')) {
      raw = part.slice('--target='.length);
      break;
    }
    if (part === '--target') {
      raw = argv[i + 1];
      break;
    }
  }

  if (!raw) {
    raw = process.env.RUNTIME_TARGET || process.env.RUNTIME || process.env.DEPLOY_TARGET;
  }

  const target = normalize(raw) || 'local';
  return target;
}

export function childEnv(target) {
  return { ...process.env, RUNTIME_TARGET: target };
}

export function isCloudflare(target) {
  return target === 'cloudflare';
}

export function isLocalLike(target) {
  return target === 'local' || target === 'docker';
}
