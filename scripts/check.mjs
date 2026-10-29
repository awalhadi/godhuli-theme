// Quality gate: contrast (APCA), selection/diff legibility, CVD separation, completeness.
// Run: npm run check -> gate report, exits 1 on failure
//      npm run docs  -> same, and regenerates docs/PALETTE.md
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CVD_TYPES, apca, composite, deltaE, hexToLch, isHex, simulateCvd } from './lib/color.mjs';
import { FLAVOR_IDS, ROOT, buildTheme, themeFile } from './lib/tokens.mjs';

// [role, minLc, maxLc] measured against editor background. Mist trades ~6 Lc for comfort by design.
const TEXT_GATES = [
  ['fg', 75, 92],
  ['comment', 45, 60],
  ['comment-doc', 45, 66],
  ['string', 70],
  ['control', 64],
  ['keyword', 58],
  ['type', 60],
  ['type-builtin', 60],
  ['function', 60],
  ['method', 60],
  ['function-builtin', 60],
  ['variable-builtin', 60],
  ['macro', 58],
  ['parameter', 62],
  ['property', 62],
  ['constant', 62],
  ['number', 58],
  ['regexp', 58],
  ['tag', 54],
  ['attribute', 58],
  ['namespace', 54],
  ['operator', 48],
  ['punctuation', 44, 60],
  ['error', 50],
  ['warn', 56],
  ['info', 56],
  ['ghost', 34, 50],
];
const MIST_SLACK = { fg: 6, string: 6, control: 4, comment: 2 };

// [label, textRef, backgroundKeys (composited bottom -> top), minLc]
const PAIR_GATES = [
  ['selection · fg', 'fg', ['editor.background', 'editor.selectionBackground'], 60],
  ['selection · string', 'string', ['editor.background', 'editor.selectionBackground'], 60],
  ['selection · keyword', 'keyword', ['editor.background', 'editor.selectionBackground'], 52],
  ['selection · comment', 'comment', ['editor.background', 'editor.selectionBackground'], 40],
  ['current line · fg', 'fg', ['editor.lineHighlightBackground'], 72],
  ['current line · comment', 'comment', ['editor.lineHighlightBackground'], 43],
  ['find current · fg', 'fg', ['editor.background', 'editor.findMatchBackground'], 55],
  ['find other · string', 'string', ['editor.background', 'editor.findMatchHighlightBackground'], 60],
  ['diff insert word · string', 'string', ['editor.background', 'diffEditor.insertedLineBackground', 'diffEditor.insertedTextBackground'], 58],
  ['diff delete word · fg', 'fg', ['editor.background', 'diffEditor.removedLineBackground', 'diffEditor.removedTextBackground'], 62],
  ['diff delete word · keyword', 'keyword', ['editor.background', 'diffEditor.removedLineBackground', 'diffEditor.removedTextBackground'], 50],
  ['inlay hint', 'editorInlayHint.foreground', ['editor.background', 'editorInlayHint.background'], 36],
  ['line number', 'editorLineNumber.foreground', ['editor.background'], 26],
  ['line number · active', 'editorLineNumber.activeForeground', ['editor.background'], 50],
  ['tab · active', 'tab.activeForeground', ['tab.activeBackground'], 75],
  ['tab · inactive', 'tab.inactiveForeground', ['editorGroupHeader.tabsBackground', 'tab.inactiveBackground'], 36],
  ['panel title · inactive', 'panelTitle.inactiveForeground', ['panel.background'], 36],
  ['breadcrumb', 'breadcrumb.foreground', ['breadcrumb.background'], 36],
  ['sidebar text', 'sideBar.foreground', ['sideBar.background'], 55],
  ['list selection', 'list.activeSelectionForeground', ['sideBar.background', 'list.activeSelectionBackground'], 72],
  ['suggest', 'editorSuggestWidget.foreground', ['editorSuggestWidget.background'], 72],
  ['suggest · selected', 'editorSuggestWidget.selectedForeground', ['editorSuggestWidget.background', 'editorSuggestWidget.selectedBackground'], 72],
  ['hover', 'editorHoverWidget.foreground', ['editorHoverWidget.background'], 72],
  ['status bar', 'statusBar.foreground', ['statusBar.background'], 55],
  ['status bar · debugging', 'statusBar.debuggingForeground', ['statusBar.debuggingBackground'], 55],
  ['button', 'button.foreground', ['button.background'], 55],
  ['badge', 'activityBarBadge.foreground', ['activityBar.background', 'activityBarBadge.background'], 55],
  ['input', 'input.foreground', ['input.background'], 72],
  ['terminal fg', 'terminal.foreground', ['terminal.background'], 75],
];

// Pairs that must stay apart under every CVD simulation. Add/delete and pass/fail must differ in
// lightness (ΔL*), not hue alone; type vs string also has quotes and casing as cues, so ΔE suffices.
const CVD_PAIRS = [
  ['git-add', 'git-del', 'L', 8],
  ['success', 'error', 'L', 8],
  ['type', 'string', 'E', 12],
  ['function', 'type', 'E', 8],
  ['keyword', 'function', 'E', 7],
  ['control', 'function', 'E', 7],
  ['control', 'macro', 'E', 8],
];
// Mist deliberately trades hue separation for minimum chroma; its ΔE floors scale by this factor.
const MIST_CVD_FACTOR = 0.65;

// Editor canvas L* per flavor: Night is the deep OLED-friendly variant.
// Light is capped at 95 to keep paper glare down.
const CANVAS_L = { dark: [11, 18], mist: [11, 18], night: [5, 10], light: [92, 95] };

// Borderless design: these surfaces must be one chrome plane, one clear step below the editor.
const CHROME_KEYS = [
  'titleBar.activeBackground',
  'activityBar.background',
  'sideBar.background',
  'editorGroupHeader.tabsBackground',
  'panel.background',
  'terminal.background',
  'statusBar.background',
];
const MIN_PLANE_STEP = 2.5;

// Night is viewed on OLED in the dark: cap identifier contrast to limit halation around glyphs.
const FG_MAX_LC = { night: 78 };

const BRACKETS = ['bracket-1', 'bracket-2', 'bracket-3', 'bracket-4', 'bracket-5', 'bracket-6'];

const lc = (text, bg) => Math.abs(apca(text, bg));
const fmt = (n) => n.toFixed(1).padStart(5);

let failures = 0;
const report = (ok, line) => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${line}`);
};

const flavors = FLAVOR_IDS.map((id) => ({ id, ...buildTheme(id) }));

// ---- role parity across flavors -----------------------------------------
const roleSets = flavors.map((f) => Object.keys(f.roles).sort().join());
console.log('\nrole parity');
report(roleSets.every((s) => s === roleSets[0]), `all ${flavors.length} flavors define the same ${Object.keys(flavors[0].roles).length} roles`);

for (const { id, theme, roles, flavor } of flavors) {
  console.log(`\n${flavor.name}  (${themeFile(id)})`);
  const bg = roles.bg;
  const slack = id === 'mist' ? MIST_SLACK : {};

  // generated file is current
  const onDisk = readFileSync(join(ROOT, themeFile(id)), 'utf8');
  report(onDisk === `${JSON.stringify(theme, null, 2)}\n`, 'theme file matches tokens (run `npm run build` if not)');

  // every emitted color is valid hex
  const bad = Object.entries(theme.colors).filter(([, v]) => !isHex(v));
  report(bad.length === 0, `${Object.keys(theme.colors).length} workbench colors are valid #RRGGBB[AA]${bad.length ? `: ${bad.map(([k]) => k).join(', ')}` : ''}`);

  // canvas comfort
  const canvasL = hexToLch(bg).L;
  const range = CANVAS_L[id];
  report(canvasL >= range[0] && canvasL <= range[1], `editor canvas L* ${canvasL.toFixed(1)} within [${range}] (no #000 / #FFF wall)`);
  const chrome = new Set(CHROME_KEYS.map((key) => theme.colors[key]));
  report(chrome.size === 1, `chrome is one unified plane (${[...chrome].join(', ')})`);
  const step = canvasL - hexToLch(theme.colors['sideBar.background']).L;
  report(step >= MIN_PLANE_STEP, `editor sits ${step.toFixed(1)} L* above chrome  [${MIN_PLANE_STEP}+]`);
  if (FG_MAX_LC[id]) report(lc(roles.fg, bg) <= FG_MAX_LC[id], `identifier contrast capped for halation (Lc ${lc(roles.fg, bg).toFixed(1)} ≤ ${FG_MAX_LC[id]})`);
  const bgC = Math.max(...['bg-deep', 'bg-dim', 'bg', 'elevated', 'border'].map((r) => hexToLch(roles[r]).C));
  const maxBgC = flavor.type === 'light' ? 8 : 6; // warm paper carries a little more chroma than umber
  report(bgC <= maxBgC, `large-area chroma ≤ ${maxBgC} (max C* ${bgC.toFixed(1)})`);

  // token contrast
  for (const [role, min, max = 108] of TEXT_GATES) {
    const value = lc(roles[role], bg);
    const lo = min - (slack[role] ?? 0);
    const hi = max - (slack[role] ?? 0) * (role === 'fg' ? 1 : 0);
    report(value >= lo && value <= hi, `${role.padEnd(17)} ${roles[role]}  Lc ${fmt(value)}  [${lo}${max < 108 ? `–${hi}` : '+'}]`);
  }
  report(lc(roles.control, bg) > lc(roles.keyword, bg), 'control flow outranks other keywords');
  report(lc(roles.punctuation, bg) < lc(roles.fg, bg) - 15, 'punctuation stays ≥15 Lc under identifiers');
  report(deltaE(roles.ghost, roles.comment) >= 8, `ghost text ≠ comment (ΔE ${deltaE(roles.ghost, roles.comment).toFixed(1)})`);
  report(deltaE(roles.ghost, roles.inlay) >= 6, `ghost text ≠ inlay hint (ΔE ${deltaE(roles.ghost, roles.inlay).toFixed(1)})`);

  // composited pairs
  for (const [label, textRef, layers, min] of PAIR_GATES) {
    const text = roles[textRef] ?? theme.colors[textRef];
    if (theme.colors[layers[0]].length !== 7) throw new Error(`${label}: base layer ${layers[0]} must be opaque`);
    const surface = layers.reduce((under, key) => (under ? composite(theme.colors[key], under) : theme.colors[key]), null);
    const value = lc(text.slice(0, 7), surface);
    report(value >= min, `${label.padEnd(28)} Lc ${fmt(value)}  [${min}+]`);
  }

  // color-vision separation
  for (const [a, b, metric, base] of CVD_PAIRS) {
    const min = id === 'mist' && metric === 'E' ? +(base * MIST_CVD_FACTOR).toFixed(1) : base;
    const worst = Math.min(
      ...['normal', ...CVD_TYPES].map((t) => {
        const [x, y] = t === 'normal' ? [roles[a], roles[b]] : [simulateCvd(roles[a], t), simulateCvd(roles[b], t)];
        return metric === 'L' ? Math.abs(hexToLch(x).L - hexToLch(y).L) : deltaE(x, y);
      }),
    );
    report(worst >= min, `${a} vs ${b}: worst Δ${metric}${metric === 'L' ? '*' : ''} across normal/protan/deutan/tritan ${worst.toFixed(1)}  [${min}+]`);
  }

  // bracket pair distinctness
  let minBracket = Infinity;
  for (let i = 0; i < BRACKETS.length; i++)
    for (let j = i + 1; j < BRACKETS.length; j++) minBracket = Math.min(minBracket, deltaE(roles[BRACKETS[i]], roles[BRACKETS[j]]));
  report(minBracket >= 10, `bracket colors pairwise ΔE ≥ 10 (min ${minBracket.toFixed(1)})`);
  const bracketC = Math.max(...BRACKETS.map((r) => hexToLch(roles[r]).C));
  report(bracketC <= 45, `bracket chroma stays calm (max C* ${bracketC.toFixed(1)})`);

  // terminal ANSI legibility
  const ansi = Object.keys(roles).filter((r) => r.startsWith('ansi-') && !/black|white/.test(r));
  const ansiMin = Math.min(...ansi.map((r) => lc(roles[r], theme.colors['terminal.background'])));
  report(ansiMin >= 45, `ANSI colors readable on terminal bg (min Lc ${ansiMin.toFixed(1)})`);
}

// ---- generated palette reference ---------------------------------------
if (process.argv.includes('--docs')) {
  const lines = [
    '# Godhuli palette reference',
    '',
    '_Generated by `npm run docs` from `tokens/palette.json`. Do not edit by hand._',
    '',
    'L\\*, C\\*, h° are CIELAB LCh (D65). Lc is APCA (SAPC 0.0.98G) of the role as text on that flavor\'s editor background; negative = light text on dark.',
  ];
  for (const { roles, flavor } of flavors) {
    lines.push('', `## ${flavor.name}`, '', '| Role | Hex | L* | C* | h° | Lc vs bg |', '|---|---|---:|---:|---:|---:|');
    for (const [role, hex] of Object.entries(roles)) {
      const { L, C, h } = hexToLch(hex);
      lines.push(`| ${role} | \`${hex}\` | ${L.toFixed(1)} | ${C.toFixed(1)} | ${C < 2 ? '—' : h.toFixed(0)} | ${role === 'bg' ? '—' : apca(hex, roles.bg).toFixed(1)} |`);
    }
  }
  mkdirSync(join(ROOT, 'docs'), { recursive: true });
  writeFileSync(join(ROOT, 'docs/PALETTE.md'), `${lines.join('\n')}\n`);
  console.log('\nwrote docs/PALETTE.md');
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
