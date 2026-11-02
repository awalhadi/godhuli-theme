// Scope audit: which TextMate rule actually wins for every token in preview/, using VS Code's grammars (Shiki).
// Each rule gets a unique probe color, so the color Shiki resolves names the winning rule under vscode-textmate's
// own precedence. Reports per-language coverage, visible tokens that fall through to the default foreground,
// rules that never win, selector scopes no installed grammar emits, and the color budget: how many hue families
// compete on one line. Exits 1 on a budget breach or an invented scope, so it can gate releases.
// Run: npm run scopes            summary
//      npm run scopes -- -v      also list fall-through tokens per file
//      npm run scopes -- --write also write docs/LANGUAGES.md (tested language list)
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHighlighter } from 'shiki';
import { previewFiles } from './lib/preview.mjs';
import { ROOT, familyOf, syntax } from './lib/tokens.mjs';

const VERBOSE = process.argv.includes('-v');

// Color budget: non-neutral hue families on one line (see FAMILIES). More than this reads as a rainbow.
const BUDGET = { p95: 3, max: 5 }; // measured baseline for 0.3.0 — only ever tighten
// CSV is rainbow by design (one color per column).
const BUDGET_EXEMPT = new Set(['csv']);
// Scopes from popular third-party grammars that aren't installed here (Even Better TOML).
const THIRD_PARTY = [/\.toml$/];

const { files, skipped } = previewFiles();

// ---- probe theme ---------------------------------------------------------

const DEFAULT = '#FFFFFE';
const probeColor = (i) => `#${(i + 1).toString(16).padStart(6, '0').toUpperCase()}`;
const probe = {
  name: 'probe',
  type: 'dark',
  colors: { 'editor.foreground': DEFAULT, 'editor.background': '#000000' },
  tokenColors: syntax.rules.map(({ scope }, i) => ({ scope, settings: { foreground: probeColor(i) } })),
};

const highlighter = await createHighlighter({ themes: [probe], langs: [...new Set(files.map((f) => f.lang))] });

// Tokens the grammar leaves unscoped (bare `source.*` / `meta.*` text, plain identifiers) can't be themed;
// only report tokens that carry a real scope no rule styles.
const PLAIN = /^(source|text)\.[\w.-]+$|^meta\.|^string\.unquoted\.plain|^variable\.other\.readwrite$/;

const hits = new Array(syntax.rules.length).fill(0);
const byLang = {};
const fallthrough = new Map(); // deepest scope -> { count, sample, files }
const budget = []; // { families, where, text }

for (const file of files) {
  const code = readFileSync(file.path, 'utf8');
  // No time limit: with includeExplanation Shiki tokenizes each line twice, and a cold grammar (PHP) can hit the
  // 500 ms default in only one pass, leaving the two token lists out of step (crash on `startIndex`).
  const { tokens } = highlighter.codeToTokens(code, { lang: file.lang, theme: 'probe', includeExplanation: true, tokenizeTimeLimit: 0 });
  const stats = (byLang[file.lang] ??= { files: [], tokens: 0, styled: 0, rules: new Set() });
  stats.files.push(file.rel);
  tokens.forEach((line, n) => {
    const families = new Set();
    for (const token of line) {
      if (!token.content.trim()) continue;
      const color = token.color?.toUpperCase();
      stats.tokens++;
      if (color && color !== DEFAULT) {
        const i = parseInt(color.slice(1), 16) - 1;
        hits[i]++;
        stats.styled++;
        stats.rules.add(i);
        families.add(familyOf(syntax.rules[i].role));
        continue;
      }
      for (const part of token.explanation ?? []) {
        if (!part.content.trim()) continue;
        const scopes = part.scopes.map((s) => s.scopeName);
        const deepest = scopes.at(-1);
        if (PLAIN.test(deepest)) continue;
        const entry = fallthrough.get(deepest) ?? { count: 0, sample: part.content.trim(), files: new Set() };
        entry.count++;
        entry.files.add(file.rel);
        fallthrough.set(deepest, entry);
      }
    }
    families.delete('neutral');
    if (!BUDGET_EXEMPT.has(file.lang) && line.some((t) => t.content.trim()))
      budget.push({ families: families.size, where: `${file.rel}:${n + 1}`, text: line.map((t) => t.content).join('').trim() });
  });
}

// ---- grammar scope inventory (VS Code built-ins, installed extensions, Shiki) ----

function grammarScopes() {
  const dirs = [
    '/usr/share/code/resources/app/extensions',
    '/Applications/Visual Studio Code.app/Contents/Resources/app/extensions',
    join(homedir(), '.vscode/extensions'),
  ].filter(existsSync);
  const texts = [];
  for (const dir of dirs)
    for (const ext of readdirSync(dir)) {
      const syn = join(dir, ext, 'syntaxes');
      if (existsSync(syn) && statSync(syn).isDirectory())
        for (const f of readdirSync(syn)) if (/\.(json|tmLanguage)$/i.test(f)) texts.push(readFileSync(join(syn, f), 'utf8'));
    }
  const langsDir = join(ROOT, 'node_modules/@shikijs/langs/dist');
  for (const f of readdirSync(langsDir)) if (f.endsWith('.mjs')) texts.push(readFileSync(join(langsDir, f), 'utf8').replace(/\\"/g, '"'));
  const names = new Set();
  const re = /"(?:name|contentName|scopeName)"\s*:\s*"([^"]+)"|<key>(?:name|contentName|scopeName)<\/key>\s*<string>([^<]+)<\/string>/g;
  for (const text of texts) for (const m of text.matchAll(re)) for (const s of (m[1] ?? m[2]).split(/\s+/)) names.add(s);
  return names;
}

const known = [...grammarScopes()];
const knownSet = new Set(known);
// A selector part is real if some grammar scope equals it or extends it (`keyword.control` ⊂ `keyword.control.flow.ts`).
// Grammars that build names from captures (`keyword.$1.ts`) are matched loosely on their static prefix.
const prefixes = known.filter((s) => s.includes('$')).map((s) => s.slice(0, s.indexOf('$')));
const isEmitted = (part) =>
  knownSet.has(part) || known.some((s) => s.startsWith(`${part}.`)) || prefixes.some((p) => p && part.startsWith(p));

const unknownParts = [];
syntax.rules.forEach(({ name, scope }) => {
  for (const selector of scope)
    for (const part of selector.split(/\s+/))
      if (!isEmitted(part)) unknownParts.push({ line: `${name}: ${part}`, thirdParty: THIRD_PARTY.some((re) => re.test(part)) });
});

// ---- report ---------------------------------------------------------------

console.log(`\nscope audit · ${files.length} files · ${Object.keys(byLang).length} languages · ${syntax.rules.length} rules`);
if (skipped.length) console.log(`  not tokenized (no grammar mapping): ${skipped.join(', ')}`);

console.log('\nlanguage            files  tokens  styled  rules');
for (const [lang, s] of Object.entries(byLang).sort())
  console.log(`  ${lang.padEnd(17)} ${String(s.files.length).padStart(5)}  ${String(s.tokens).padStart(6)}  ${((100 * s.styled) / s.tokens).toFixed(0).padStart(5)}%  ${String(s.rules.size).padStart(5)}`);

const falls = [...fallthrough.entries()].sort((a, b) => b[1].count - a[1].count);
console.log(`\nfall-through to default foreground (non-identifier tokens): ${falls.length} scopes`);
for (const [scope, { count, sample, files: where }] of falls.slice(0, VERBOSE ? Infinity : 40))
  console.log(`  ${String(count).padStart(4)}  ${scope.padEnd(58)} ${JSON.stringify(sample.slice(0, 24))}${VERBOSE ? `  ${[...where].join(', ')}` : ''}`);

const dead = syntax.rules.map((r, i) => [r.name, hits[i]]).filter(([, n]) => n === 0);
console.log(`\nrules that never win in the corpus: ${dead.length}`);
for (const [name] of dead) console.log(`  ${name}`);

console.log(`\nselector scopes no installed grammar emits: ${unknownParts.length}`);
for (const { line, thirdParty } of unknownParts) console.log(`  ${thirdParty ? '(third-party) ' : 'FAIL '}${line}`);

const counts = budget.map((b) => b.families).sort((a, b) => a - b);
const p95 = counts[Math.floor(counts.length * 0.95)];
const max = counts.at(-1);
const histogram = counts.reduce((h, n) => ((h[n] = (h[n] ?? 0) + 1), h), {});
console.log(`\ncolor budget (non-neutral hue families per line, ${counts.length} lines)`);
console.log(`  ${Object.entries(histogram).map(([n, c]) => `${n}: ${((100 * c) / counts.length).toFixed(1)}%`).join('  ')}`);
console.log(`  ${p95 <= BUDGET.p95 ? 'ok  ' : 'FAIL'} p95 ${p95}  [≤ ${BUDGET.p95}]`);
console.log(`  ${max <= BUDGET.max ? 'ok  ' : 'FAIL'} max ${max}  [≤ ${BUDGET.max}]`);
for (const b of budget.filter((x) => x.families >= Math.max(BUDGET.max, max)).slice(0, 8))
  console.log(`       ${b.families}  ${b.where}  ${b.text.slice(0, 70)}`);

if (process.argv.includes('--write')) {
  const rows = Object.entries(byLang)
    .sort()
    .map(([lang, s]) => `| ${lang} | ${s.files.map((f) => `\`${f}\``).join(', ')} |`);
  writeFileSync(
    join(ROOT, 'docs/LANGUAGES.md'),
    ['# Tested languages', '', '_Generated by `npm run scopes -- --write` from `preview/`. Do not edit by hand._', '',
      'Each language below has a sample file tokenized with VS Code\'s TextMate grammar and checked against the theme rules.', '',
      '| Language | Samples |', '|---|---|', ...rows, ''].join('\n'),
  );
  console.log('\nwrote docs/LANGUAGES.md');
}

const failed = p95 > BUDGET.p95 || max > BUDGET.max || unknownParts.some((u) => !u.thirdParty);
console.log(failed ? '\nscope audit failed.' : '\nScope audit passed.');
process.exit(failed ? 1 : 0);
