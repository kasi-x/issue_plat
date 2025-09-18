export type RuntimeTarget = 'local' | 'docker' | 'cloudflare';

const ALIASES = new Map<string, RuntimeTarget>([
  ['cf', 'cloudflare'],
  ['cloud', 'cloudflare'],
  ['cloudflare', 'cloudflare'],
  ['pages', 'cloudflare'],
  ['local', 'local'],
  ['native', 'local'],
  ['dev', 'local'],
  ['docker', 'docker'],
  ['container', 'docker'],
]);

function normalize(value: string | null | undefined): RuntimeTarget {
  if (!value) return 'local';
  const key = value.trim().toLowerCase();
  return ALIASES.get(key) ?? (key === 'cloudflare' ? 'cloudflare' : key === 'docker' ? 'docker' : 'local');
}

export function getRuntimeTarget(): RuntimeTarget {
  const raw = process.env.RUNTIME_TARGET || process.env.RUNTIME || process.env.DEPLOY_TARGET;
  return normalize(raw);
}

export function isCloudflareRuntime(target: RuntimeTarget = getRuntimeTarget()): boolean {
  return target === 'cloudflare';
}

export function isDockerRuntime(target: RuntimeTarget = getRuntimeTarget()): boolean {
  return target === 'docker';
}

export function isLocalRuntime(target: RuntimeTarget = getRuntimeTarget()): boolean {
  return target === 'local';
}

export function isLocalLikeRuntime(target: RuntimeTarget = getRuntimeTarget()): boolean {
  return target === 'local' || target === 'docker';
}

export function describeRuntime(target: RuntimeTarget = getRuntimeTarget()): string {
  return target;
}
