// Quality gate: contrast (APCA), selection/diff legibility, CVD separation, completeness.
// Run: npm run check -> gate report, exits 1 on failure
//      npm run docs  -> same, and regenerates docs/PALETTE.md
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CVD_TYPES, apca, composite, deltaE, hexToLch, isHex, simulateCvd } from './lib/color.mjs';
import { SEMANTIC_MODIFIERS, SEMANTIC_TYPES } from './lib/semantic-vocab.mjs';
import { FLAVOR_IDS, ROOT, buildTheme, semantic, syntax, themeFile } from './lib/tokens.mjs';

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

// High-contrast flavors replace TEXT_GATES with stricter floors: every syntax role reads at Lc 65+, comments
// and punctuation stay readable (not receding) but remain the quietest text.
const HC_TEXT_GATES = [
  ['fg', 90, 108],
  ['comment', 60, 76],
  ['comment-doc', 62, 80],
  ['string', 80],
  ['control', 85],
  ['keyword', 75],
  ['type', 80],
  ['type-builtin', 70],
  ['function', 70],
  ['method', 75],
  ['function-builtin', 65],
  ['variable-builtin', 70],
  ['macro', 70],
  ['parameter', 75],
  ['property', 75],
  ['constant', 75],
  ['number', 68],
  ['regexp', 75],
  ['tag', 65],
  ['attribute', 75],
  ['namespace', 65],
  ['operator', 65],
  ['punctuation', 55, 75],
  ['error', 58],
  ['warn', 70],
  ['info', 70],
  ['ghost', 42, 60],
];

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
  ['inactive selection · fg', 'fg', ['editor.background', 'editor.inactiveSelectionBackground'], 66],
  ['selection · function', 'function', ['editor.background', 'editor.selectionBackground'], 52],
  ['selection · type', 'type', ['editor.background', 'editor.selectionBackground'], 52],
  ['word highlight · fg', 'fg', ['editor.background', 'editor.wordHighlightBackground'], 70],
  ['find in selection · fg', 'fg', ['editor.background', 'editor.findRangeHighlightBackground'], 72],
  ['bracket match · punctuation', 'punctuation', ['editor.background', 'editorBracketMatch.background'], 40],
  ['sticky scroll · fg', 'fg', ['editorStickyScroll.background'], 72],
  ['peek editor · fg', 'fg', ['peekViewEditor.background'], 72],
  ['merge current · fg', 'fg', ['editor.background', 'merge.currentContentBackground'], 68],
  ['merge incoming · fg', 'fg', ['editor.background', 'merge.incomingContentBackground'], 68],
  ['diff insert line · keyword', 'keyword', ['editor.background', 'diffEditor.insertedLineBackground'], 54],
  ['diff remove line · string', 'string', ['editor.background', 'diffEditor.removedLineBackground'], 62],
  ['suggest match · selected', 'editorSuggestWidget.focusHighlightForeground', ['editorSuggestWidget.background', 'editorSuggestWidget.selectedBackground'], 55],
  ['ghost text · current line', 'editorGhostText.foreground', ['editor.lineHighlightBackground'], 34],
  ['codelens', 'editorCodeLens.foreground', ['editor.background'], 30],
  ['hover · code block', 'fg', ['editorHoverWidget.codeBackground'], 72],
  ['cursor · current line', 'editorCursor.foreground', ['editor.lineHighlightBackground'], 60],
  ['cursor · over selection', 'editorCursor.foreground', ['editor.background', 'editor.selectionBackground'], 45],
  ['squiggle · error', 'editorError.foreground', ['editor.background'], 50],
  ['squiggle · warning', 'editorWarning.foreground', ['editor.background'], 50],
  ['squiggle · info', 'editorInfo.foreground', ['editor.background'], 50],
  ['squiggle · hint', 'editorHint.foreground', ['editor.background'], 50],
];

// Salience: what the eye should find first. Comments and punctuation recede below every code role,
// structure (operators) sits above punctuation, and errors are the most saturated diagnostic.
const CODE_ROLES = ['fg', 'string', 'control', 'keyword', 'type', 'type-builtin', 'function', 'method', 'function-builtin',
  'variable-builtin', 'macro', 'parameter', 'property', 'constant', 'number', 'regexp', 'tag', 'attribute', 'namespace'];
const RECEDE_MARGIN = 5;

// Syntax roles that sit side by side in real code must stay apart under every CVD simulation
// (worst ΔE across normal/protan/deutan/tritan). Mist floors scale by MIST_CVD_FACTOR.
const SYNTAX_PAIRS = [
  ['punctuation', 'comment', 10],
  ['macro', 'regexp', 10],
  ['string', 'regexp', 10],
  ['function', 'method', 8],
  ['function', 'function-builtin', 7],
  ['method', 'function-builtin', 7],
  ['type', 'type-builtin', 6],
  ['type', 'type-param', 12],
  ['type-builtin', 'namespace', 6],
  ['variable-builtin', 'property', 6],
  ['fg', 'parameter', 8],
  ['fg', 'property', 8],
  ['inlay', 'comment', 8],
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
  ['control', 'keyword', 'E', 8],
  ['error', 'warn', 'E', 12],
];
// Mist deliberately trades hue separation for minimum chroma; its ΔE floors scale by this factor.
const MIST_CVD_FACTOR = 0.65;

// Editor canvas L* per flavor: Night is the deep OLED-friendly variant.
// Light is capped at 95 to keep paper glare down.
const CANVAS_L = { dark: [11, 18], mist: [11, 18], night: [5, 10], hc: [3, 8], light: [92, 95] };

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
// High-contrast flavors keep the unified planes but must draw visible borders and focus rings on top of them.
const HC_BORDER_GATES = [
  ['contrastBorder', 45],
  ['contrastActiveBorder', 60],
  ['focusBorder', 60],
];

// Night is viewed on OLED in the dark: cap identifier contrast to limit halation around glyphs.
const FG_MAX_LC = { night: 78 };

const BRACKETS = ['bracket-1', 'bracket-2', 'bracket-3', 'bracket-4', 'bracket-5', 'bracket-6'];

const badSelector = (selector) => {
  const [body, lang] = selector.split(':');
  const [type, ...mods] = body.split('.');
  return !SEMANTIC_TYPES.has(type) || mods.some((m) => !SEMANTIC_MODIFIERS.has(m)) || lang === '';
};

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

// ---- rule hygiene ---------------------------------------------------------
console.log('\nrule hygiene');
const owners = {};
for (const { name, scope } of syntax.rules) for (const sc of scope) (owners[sc] ??= []).push(name);
const dupes = Object.entries(owners).filter(([, names]) => names.length > 1);
report(dupes.length === 0, `each TextMate scope has one owner${dupes.length ? `: ${dupes.map(([sc, n]) => `${sc} (${n.join(' / ')})`).join('; ')}` : ''}`);
const badSelectors = Object.keys(semantic).filter((k) => !k.startsWith('$') && badSelector(k));
report(badSelectors.length === 0, `semantic selectors use known token types/modifiers${badSelectors.length ? `: ${badSelectors.join(', ')}` : ''}`);

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

  if (flavor.contrast === 'high')
    for (const [key, min] of HC_BORDER_GATES) {
      const value = lc(composite(theme.colors[key], theme.colors['sideBar.background']), theme.colors['sideBar.background']);
      report(value >= min, `${key.padEnd(26)} visible on chrome  Lc ${fmt(value)}  [${min}+]`);
    }

  // token contrast
  for (const [role, min, max = 108] of flavor.contrast === 'high' ? HC_TEXT_GATES : TEXT_GATES) {
    const value = lc(roles[role], bg);
    const lo = min - (slack[role] ?? 0);
    const hi = max - (slack[role] ?? 0) * (role === 'fg' ? 1 : 0);
    report(value >= lo && value <= hi, `${role.padEnd(17)} ${roles[role]}  Lc ${fmt(value)}  [${lo}${max < 108 ? `–${hi}` : '+'}]`);
  }
  report(lc(roles.control, bg) > lc(roles.keyword, bg), 'control flow outranks other keywords');
  report(lc(roles.control, bg) >= lc(roles.keyword, bg) + 5, `control flow ≥ keywords + 5 Lc (${fmt(lc(roles.control, bg) - lc(roles.keyword, bg))})`);
  const quietestCode = Math.min(...CODE_ROLES.map((r) => lc(roles[r], bg)));
  for (const r of ['comment', 'punctuation'])
    report(lc(roles[r], bg) <= quietestCode - RECEDE_MARGIN, `${r} recedes ≥${RECEDE_MARGIN} Lc below every code role (${fmt(quietestCode - lc(roles[r], bg))})`);
  report(lc(roles.operator, bg) >= lc(roles.punctuation, bg), 'operators read above punctuation');
  const diagC = (r) => hexToLch(roles[r]).C;
  report(diagC('error') >= Math.max(diagC('warn'), diagC('info')), `error is the most saturated diagnostic (C* ${diagC('error').toFixed(0)} vs ${diagC('warn').toFixed(0)}/${diagC('info').toFixed(0)})`);
  const cursorOnBg = (key) => composite(theme.colors[key], bg);
  report(deltaE(cursorOnBg('editorMultiCursor.primary.foreground'), cursorOnBg('editorMultiCursor.secondary.foreground')) >= 8,
    'secondary cursors are distinguishable from the primary');
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

  // side-by-side syntax separation
  for (const [a, b, base] of SYNTAX_PAIRS) {
    const min = id === 'mist' ? +(base * MIST_CVD_FACTOR).toFixed(1) : base;
    const worst = Math.min(
      ...['normal', ...CVD_TYPES].map((t) => (t === 'normal' ? deltaE(roles[a], roles[b]) : deltaE(simulateCvd(roles[a], t), simulateCvd(roles[b], t)))),
    );
    report(worst >= min, `${a} vs ${b}: worst ΔE across normal/CVD ${worst.toFixed(1)}  [${min}+]`);
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
