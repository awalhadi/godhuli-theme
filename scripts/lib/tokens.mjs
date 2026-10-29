// Loads tokens/*.json and resolves them into complete VS Code theme objects.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isHex, scaleChroma } from './color.mjs';

const TOKENS = new URL('../../tokens/', import.meta.url);
const load = (name) => JSON.parse(readFileSync(new URL(name, TOKENS), 'utf8'));

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const palette = load('palette.json');
export const workbench = load('workbench.json');
export const semantic = load('semantic.json');
export const syntax = load('syntax.json');

export const FLAVOR_IDS = Object.keys(palette.flavors);

// Raw (unaliased) role map for a flavor, applying `extends` + `chroma` (minus `keepChroma`) recursively.
function rawRoles(id) {
  const flavor = palette.flavors[id];
  if (!flavor) throw new Error(`Unknown flavor: ${id}`);
  if (!flavor.extends) return { ...flavor.roles };
  const factor = flavor.chroma ?? 1;
  const keep = flavor.keepChroma ?? []; // role prefixes whose signal must survive desaturation
  const inherited = Object.fromEntries(
    Object.entries(rawRoles(flavor.extends)).map(([role, value]) => [
      role,
      factor !== 1 && isHex(value) && !keep.some((prefix) => role.startsWith(prefix)) ? scaleChroma(value, factor) : value,
    ]),
  );
  return { ...inherited, ...flavor.roles };
}

export function resolveRoles(id) {
  const raw = rawRoles(id);
  const resolved = {};
  const resolve = (role, chain = []) => {
    if (resolved[role]) return resolved[role];
    const value = raw[role];
    if (value === undefined) throw new Error(`[${id}] unknown role "${role}"${chain.length ? ` via ${chain.join(' -> ')}` : ''}`);
    if (chain.includes(role)) throw new Error(`[${id}] alias cycle: ${[...chain, role].join(' -> ')}`);
    const hex = value.startsWith('=') ? resolve(value.slice(1), [...chain, role]) : value;
    if (!isHex(hex) || hex.length !== 7) throw new Error(`[${id}] role "${role}" must be opaque #RRGGBB, got ${hex}`);
    return (resolved[role] = hex.toUpperCase());
  };
  Object.keys(raw).forEach((role) => resolve(role));
  return resolved;
}

// "role" | "role@AA" | "transparent" | "opacity@AA" | { dark, light }
export function resolveRef(ref, roles, type) {
  if (typeof ref === 'object') return resolveRef(ref[type], roles, type);
  if (ref === 'transparent') return '#00000000';
  const [role, alpha] = ref.split('@');
  if (alpha !== undefined && !/^[0-9a-f]{2}$/i.test(alpha)) throw new Error(`Bad alpha in "${ref}"`);
  if (role === 'opacity') return `#000000${alpha.toUpperCase()}`;
  const hex = roles[role];
  if (!hex) throw new Error(`Unknown role "${role}" in "${ref}"`);
  return alpha ? hex + alpha.toUpperCase() : hex;
}

const entries = (obj) => Object.entries(obj).filter(([key]) => !key.startsWith('$'));

export function buildTheme(id) {
  const flavor = palette.flavors[id];
  const roles = resolveRoles(id);
  const ref = (value) => resolveRef(value, roles, flavor.type);

  const colors = {};
  for (const [, group] of entries(workbench)) {
    for (const [key, value] of Object.entries(group)) {
      if (key in colors) throw new Error(`Duplicate workbench key: ${key}`);
      colors[key] = ref(value);
    }
  }

  const semanticTokenColors = Object.fromEntries(
    entries(semantic).map(([selector, value]) =>
      typeof value === 'string'
        ? [selector, ref(value)]
        : [selector, { foreground: ref(value.role), fontStyle: value.fontStyle }],
    ),
  );

  const tokenColors = syntax.rules.map(({ name, scope, role, fontStyle }) => ({
    name,
    scope,
    settings: { foreground: ref(role), ...(fontStyle !== undefined && { fontStyle }) },
  }));

  return {
    theme: {
      $schema: 'vscode://schemas/color-theme',
      name: flavor.name,
      type: flavor.type,
      semanticHighlighting: true,
      colors,
      semanticTokenColors,
      tokenColors,
    },
    roles,
    flavor,
  };
}

export const themeFile = (id) => `themes/godhuli-${id}.json`;
