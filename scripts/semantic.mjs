// Semantic-token audit against real language servers. Launches VS Code (isolated profile, your installed language
// extensions, auto-update off) with the Godhuli themes and scripts/semantic-probe, which dumps the semantic tokens
// each server emits for a set of preview files. Every token is then resolved against tokens/semantic.json with
// VS Code's selector rules (type or declared supertype, modifier subset, optional :language, most specific wins).
// Run: npm run semantic            needs a local `code` CLI; languages whose server isn't installed are reported
//      npm run semantic -- --keep  keep the temp workspace and raw report
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { PREVIEW } from './lib/preview.mjs';
import { SEMANTIC_MODIFIERS, SEMANTIC_TYPES } from './lib/semantic-vocab.mjs';
import { ROOT, semantic } from './lib/tokens.mjs';

// One or more files per language server worth checking. Paths are relative to the copied preview/ workspace.
const FILES = [
  'preview.tsx', 'typescript-frameworks/react/useFetch.ts', 'typescript-frameworks/next/app/orders/OrderFilters.tsx',
  'php/laravel/OrderController.php', 'php/Money.php',
  'python/inventory.py', 'python/django/models.py',
  'rust-probe/src/lib.rs',
  'typescript-frameworks/vue/OrderTable.vue',
  'backend/cpp/inventory.cpp', 'backend/go/orders.go', 'backend/java/OrderController.java',
  'backend/csharp/OrdersEndpoints.cs',
];
const WAIT = 45; // seconds per file for a language server to answer

const KEEP = process.argv.includes('--keep');
const work = mkdtempSync(join(tmpdir(), 'godhuli-semantic-'));
const ws = join(work, 'ws');
cpSync(PREVIEW, ws, { recursive: true });
// rust-analyzer only analyses files inside a Cargo project.
mkdirSync(join(ws, 'rust-probe/src'), { recursive: true });
writeFileSync(join(ws, 'rust-probe/Cargo.toml'), '[package]\nname = "rust-probe"\nversion = "0.0.0"\nedition = "2021"\n');
cpSync(join(PREVIEW, 'preview.rs'), join(ws, 'rust-probe/src/lib.rs'));

const profile = join(work, 'profile');
mkdirSync(join(profile, 'User'), { recursive: true });
writeFileSync(join(profile, 'User/settings.json'), JSON.stringify({
  'workbench.colorTheme': 'Godhuli Dark',
  'editor.semanticHighlighting.enabled': true,
  'extensions.autoUpdate': false,
  'extensions.autoCheckUpdates': false,
  'security.workspace.trust.enabled': false,
  'chat.disableAIFeatures': true,
  'telemetry.telemetryLevel': 'off',
  'workbench.startupEditor': 'none',
  'window.restoreWindows': 'none',
}, null, 2));

const out = join(work, 'report.json');
console.log(`launching VS Code (isolated profile in ${work}) …`);
spawn('code', ['--new-window', `--user-data-dir=${profile}`, `--extensionDevelopmentPath=${ROOT}`,
  `--extensionDevelopmentPath=${join(ROOT, 'scripts/semantic-probe')}`, ws], {
  detached: true,
  stdio: 'ignore',
  env: { ...process.env, GODHULI_PROBE_OUT: out, GODHULI_PROBE_FILES: JSON.stringify(FILES.map((f) => join(ws, f))), GODHULI_PROBE_WAIT: String(WAIT) },
}).unref();

const deadline = Date.now() + (FILES.length * WAIT + 120) * 1000;
while (!existsSync(out)) {
  if (Date.now() > deadline) {
    console.error('timed out waiting for the probe report');
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
await new Promise((resolve) => setTimeout(resolve, 500));
const report = JSON.parse(readFileSync(out, 'utf8'));

// ---- selector resolution ----------------------------------------------------

// Supertypes declared by installed language extensions (`contributes.semanticTokenTypes[].superType`).
const superType = {};
const extDir = join(homedir(), '.vscode/extensions');
if (existsSync(extDir))
  for (const ext of readdirSync(extDir)) {
    try {
      const pkg = JSON.parse(readFileSync(join(extDir, ext, 'package.json'), 'utf8'));
      for (const t of pkg.contributes?.semanticTokenTypes ?? []) if (t.superType) superType[t.id] = t.superType;
    } catch {}
  }
const lineage = (type) => {
  const chain = [type];
  while (superType[chain.at(-1)] && chain.length < 8) chain.push(superType[chain.at(-1)]);
  return chain;
};

const selectors = Object.keys(semantic)
  .filter((k) => !k.startsWith('$'))
  .map((key) => {
    const [body, lang] = key.split(':');
    const [type, ...mods] = body.split('.');
    return { key, type, mods, lang, value: semantic[key] };
  });
const hasColor = (v) => typeof v === 'string' || Boolean(v.role);

// Best selector that sets a color for this token, or null (VS Code then maps the token to a TextMate scope).
function resolve(token, lang) {
  const chain = lineage(token.type);
  let best = null;
  for (const sel of selectors) {
    if (!hasColor(sel.value)) continue;
    const depth = sel.type === '*' ? -1 : chain.indexOf(sel.type);
    if (sel.type !== '*' && depth === -1) continue;
    if (!sel.mods.every((m) => token.modifiers.includes(m))) continue;
    if (sel.lang && sel.lang !== lang) continue;
    // VS Code's own scoring (tokenClassificationRegistry): 100 minus supertype level, 100 per modifier, 10 for language.
    const score = (sel.type === '*' ? 0 : 100 - depth) + sel.mods.length * 100 + (sel.lang ? 10 : 0);
    if (!best || score > best.score) best = { score, sel };
  }
  return best?.sel.key ?? null;
}

// ---- report -------------------------------------------------------------------

const unknown = new Set();
let failures = 0;
for (const entry of report) {
  const rel = entry.file.slice(ws.length + 1);
  if (entry.error || !entry.tokens.length) {
    console.log(`\n${rel}  [${entry.lang ?? '?'}]  — no semantic tokens${entry.error ? ` (${entry.error})` : ' (language server not installed or not ready)'}`);
    continue;
  }
  const groups = new Map();
  for (const token of entry.tokens) {
    const key = [token.type, ...token.modifiers.sort()].join('.');
    const g = groups.get(key) ?? { count: 0, sample: token.text, styledBy: resolve(token, entry.lang) };
    g.count++;
    groups.set(key, g);
    for (const t of lineage(token.type)) if (!SEMANTIC_TYPES.has(t)) unknown.add(`type ${t}`);
    for (const m of token.modifiers) if (!SEMANTIC_MODIFIERS.has(m)) unknown.add(`modifier ${m}`);
  }
  console.log(`\n${rel}  [${entry.lang}]  ${entry.tokens.length} tokens`);
  for (const [key, g] of [...groups.entries()].sort((a, b) => b[1].count - a[1].count))
    console.log(`  ${String(g.count).padStart(4)}  ${key.padEnd(44)} ${JSON.stringify(g.sample).slice(0, 22).padEnd(24)} → ${g.styledBy ?? 'TextMate fallback'}`);
}

if (unknown.size) {
  console.log(`\nemitted but not in the semantic vocabulary (scripts/lib/semantic-vocab.mjs): ${[...unknown].join(', ')}`);
  failures++;
}
if (KEEP) console.log(`\nkept ${work}`);
else rmSync(work, { recursive: true, force: true });
process.exit(failures ? 1 : 0);
