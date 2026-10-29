// Renders Marketplace images from the tokens: workbench screenshots per flavor, a 4-flavor grid and the icon.
// Code is highlighted by Shiki (VS Code's TextMate grammars) with our themes; the window chrome is an
// HTML mockup painted with each theme's own `colors`. Headless Chrome captures the PNGs.
// Run: npm run screenshots   (needs Google Chrome/Chromium; override with CHROME_PATH)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHighlighter } from 'shiki';
import { composite } from './lib/color.mjs';
import { FLAVOR_IDS, ROOT, buildTheme } from './lib/tokens.mjs';

const OUT = join(ROOT, 'images');
const CODE_FONT = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'DejaVu Sans Mono', monospace";
const UI_FONT = "'Inter', 'Segoe UI', 'Ubuntu', 'Cantarell', 'DejaVu Sans', system-ui, sans-serif";
const LINE_H = 20;

// from: first line (1-based) of the window, cursor: row within it; title renames the active file to match the code.
const SHOTS = [
  { out: 'hero-dark.png', flavor: 'dark', file: 'preview.tsx', lang: 'tsx', from: 76, lines: 28, cursor: 12, suggest: true },
  { out: 'night.png', flavor: 'night', file: 'preview.rs', lang: 'rust', from: 8, lines: 28, cursor: 9 },
  { out: 'mist.png', flavor: 'mist', file: 'preview.py', lang: 'python', from: 17, lines: 28, cursor: 13 },
  { out: 'light.png', flavor: 'light', file: 'preview.tsx', lang: 'tsx', from: 29, lines: 28, cursor: 18, title: 'OrderService.ts' },
];
const GRID = { out: 'flavors.png', file: 'preview.tsx', lang: 'tsx', from: 29, lines: 15 };

// ---- chrome -------------------------------------------------------------

function findChrome() {
  const candidates = [process.env.CHROME_PATH, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  for (const bin of candidates) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore' });
      return bin;
    } catch {}
  }
  throw new Error('Chrome/Chromium not found. Set CHROME_PATH to its executable.');
}

const CHROME = findChrome();
const WORK = mkdtempSync(join(tmpdir(), 'godhuli-shots-'));

function capture(html, out, width, height, scale = 2) {
  const page = join(WORK, `${out}.html`);
  writeFileSync(page, html);
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${join(WORK, 'profile')}`, `--force-device-scale-factor=${scale}`,
    `--window-size=${width},${height}`, '--default-background-color=00000000', '--virtual-time-budget=3000',
    `--screenshot=${join(OUT, out)}`, pathToFileURL(page).href,
  ], { stdio: 'ignore' });
  console.log(`images/${out.padEnd(15)} ${width * scale}×${height * scale}`);
}

// ---- code rendering -----------------------------------------------------

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const STYLE = { 1: 'font-style:italic', 2: 'font-weight:700', 4: 'text-decoration:underline', 8: 'text-decoration:line-through' };
const fontCss = (flags = 0) => Object.entries(STYLE).filter(([bit]) => flags & bit).map(([, css]) => css).join(';');

// Shiki tokens for a whole file (keeps grammar state correct), sliced to the visible window.
function tokenWindow(highlighter, { file, lang, from, lines }, themeName) {
  const code = readFileSync(join(ROOT, 'preview', file), 'utf8');
  const { tokens } = highlighter.codeToTokens(code, { lang, theme: themeName });
  return tokens.slice(from - 1, from - 1 + lines);
}

// One code line: indent guides drawn for each 2-space level, then the tokens.
function codeLine(tokens, colors, { active }) {
  const text = tokens.map((t) => t.content).join('');
  const indent = text.length - text.trimStart().length;
  const levels = Math.floor(indent / 2);
  const guides = Array.from({ length: levels }, (_, i) => {
    const color = active && i === levels - 1 ? colors['editorIndentGuide.activeBackground1'] : colors['editorIndentGuide.background1'];
    return `<span class="guide" style="box-shadow: inset 1px 0 ${color}"></span>`;
  }).join('');
  let skip = levels * 2;
  const spans = tokens.map(({ content, color, fontStyle }) => {
    const cut = Math.min(skip, content.length);
    skip -= cut;
    const rest = content.slice(cut);
    return rest ? `<span style="color:${color};${fontCss(fontStyle)}">${esc(rest)}</span>` : '';
  }).join('');
  return guides + spans;
}

function editorHtml(rows, colors, { from, cursor, selection = [], numbers = true }) {
  return rows.map((tokens, i) => {
    const current = i === cursor;
    const selected = selection.includes(i);
    const bg = current ? colors['editor.lineHighlightBackground'] : 'transparent';
    const num = numbers
      ? `<span class="ln" style="color:${current ? colors['editorLineNumber.activeForeground'] : colors['editorLineNumber.foreground']}">${from + i}</span>`
      : '';
    const body = codeLine(tokens, colors, { active: Math.abs(i - cursor) < 6 });
    const sel = selected ? ` style="background:${colors['editor.selectionBackground']}"` : '';
    const caret = current ? `<span class="caret" style="background:${colors['editorCursor.foreground']}"></span>` : '';
    return `<div class="row" style="background:${bg}">${num}<span class="code"><span class="text"${sel}>${body}</span>${caret}</span></div>`;
  }).join('');
}

// Faux minimap: a 2px bar per token, in the token's color.
function minimapHtml(rows) {
  return rows.map((tokens) => {
    const bars = tokens.map(({ content, color }) => {
      const w = content.length * 1.1;
      return content.trim() ? `<i style="width:${w}px;background:${color}"></i>` : `<i style="width:${w}px"></i>`;
    }).join('');
    return `<div class="mm">${bars}</div>`;
  }).join('');
}

// ---- workbench mockup ---------------------------------------------------

const ICONS = {
  files: '<path d="M7 3h7l4 4v13H7z"/><path d="M14 3v4h4"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  git: '<circle cx="7" cy="6" r="2.2"/><circle cx="7" cy="18" r="2.2"/><circle cx="17" cy="8" r="2.2"/><path d="M7 8.2v7.6M17 10.2c0 4-10 2-10 5.6"/>',
  debug: '<path d="M8 5l11 7-11 7z"/>',
  ext: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7" transform="rotate(12 16.5 7.5)"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
  account: '<circle cx="12" cy="9" r="3.5"/><path d="M5 20c1.5-4 12.5-4 14 0"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
};
const icon = (name, color, size = 22) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

const TREES = {
  tsx: { root: 'GODHULI-SHOP', crumbs: ['src', 'components'], items: [
    ['d', 0, 'src'], ['d', 1, 'components'], ['f', 2, 'Badge.tsx', 'M'], ['f', 2, 'OrderPanel.tsx', '', true],
    ['f', 2, 'ErrorBanner.tsx'], ['d', 1, 'api'], ['f', 2, 'client.ts', 'U'], ['f', 2, 'orders.ts'],
    ['f', 1, 'main.tsx'], ['f', 0, 'package.json', 'M'], ['f', 0, 'tsconfig.json'], ['f', 0, 'README.md'], ['f', 0, '.env', 'I'],
  ] },
  rust: { root: 'LOGWISE', crumbs: ['src'], items: [
    ['d', 0, 'src'], ['f', 1, 'entry.rs', '', true], ['f', 1, 'level.rs', 'M'], ['f', 1, 'render.rs'],
    ['f', 1, 'main.rs'], ['d', 0, 'tests'], ['f', 1, 'parse.rs', 'U'], ['f', 0, 'Cargo.toml', 'M'],
    ['f', 0, 'Cargo.lock'], ['d', 0, 'target', 'I'], ['f', 0, 'README.md'],
  ] },
  python: { root: 'PARCEL', crumbs: ['parcel'], items: [
    ['d', 0, 'parcel'], ['f', 1, '__init__.py'], ['f', 1, 'shipment.py', '', true], ['f', 1, 'manifest.py', 'M'],
    ['f', 1, 'dispatch.py'], ['d', 0, 'tests'], ['f', 1, 'test_shipment.py', 'U'], ['f', 0, 'pyproject.toml', 'M'],
    ['d', 0, '.venv', 'I'], ['f', 0, 'README.md'],
  ] },
};
const FILE_DOT = { tsx: 'type', ts: 'type', json: 'constant', md: 'info', rs: 'number', toml: 'macro', py: 'function', lock: 'fg-subtle', env: 'warn' };

function sidebarHtml(tree, c, roles) {
  const decor = { M: c['gitDecoration.modifiedResourceForeground'], U: c['gitDecoration.untrackedResourceForeground'], I: c['gitDecoration.ignoredResourceForeground'] };
  const rows = tree.items.map(([kind, depth, name, git = '', active = false]) => {
    const ext = name.split('.').pop();
    const color = git === 'I' ? decor.I : git ? decor[git] : active ? c['list.activeSelectionForeground'] : c['sideBar.foreground'];
    const bg = active ? c['list.activeSelectionBackground'] : 'transparent';
    const glyph = kind === 'd'
      ? `<span class="chev" style="color:${c['icon.foreground']}">›</span>`
      : `<span class="dot" style="background:${roles[FILE_DOT[ext]] ?? roles['fg-muted']}"></span>`;
    const badge = git && git !== 'I' ? `<span class="gitb" style="color:${decor[git]}">${git}</span>` : '';
    return `<div class="tree" style="padding-left:${12 + depth * 14}px;background:${bg};color:${color}">${glyph}<span>${name}</span>${badge}</div>`;
  }).join('');
  return `
    <div class="sb-title" style="color:${c['sideBarTitle.foreground']}">EXPLORER</div>
    <div class="sb-head" style="color:${c['sideBarSectionHeader.foreground']}"><span class="chev open">›</span>${tree.root}</div>
    ${rows}`;
}

function terminalHtml(roles, lang) {
  const a = (n) => roles[`ansi-${n}`];
  const cmd = { tsx: 'npm test', rust: 'cargo test', python: 'pytest -q' }[lang];
  return `
    <div><span style="color:${a('green')}">➜</span> <span style="color:${a('cyan')}">~/code/project</span> <span style="color:${a('blue')}">git:(</span><span style="color:${a('red')}">main</span><span style="color:${a('blue')}">)</span> ${cmd}</div>
    <div><span style="color:${a('green')}">✓</span> parses valid entries <span style="color:${a('bright-black')}">(3 ms)</span></div>
    <div><span style="color:${a('green')}">✓</span> renders totals with tax <span style="color:${a('bright-black')}">(5 ms)</span></div>
    <div><span style="color:${a('yellow')}">○</span> skipped refund flow <span style="color:${a('bright-black')}">— needs network</span></div>
    <div><span style="color:${a('red')}">✗</span> rejects malformed ids <span style="color:${a('bright-black')}">expected </span><span style="color:${a('green')}">422</span><span style="color:${a('bright-black')}">, got </span><span style="color:${a('red')}">200</span></div>
    <div><span style="color:${a('magenta')}">Tests:</span> <span style="color:${a('red')}">1 failed</span>, <span style="color:${a('yellow')}">1 skipped</span>, <span style="color:${a('green')}">2 passed</span>, 4 total</div>
    <div><span style="color:${a('green')}">➜</span> <span style="color:${a('cyan')}">~/code/project</span> <span class="tcursor" style="background:${roles.cursor}"></span></div>`;
}

function suggestHtml(c, roles) {
  const items = [['orderStatus', 'property', 'OrderStatus'], ['onRefund', 'function', '(id, reason) => Promise'], ['order', 'parameter', 'Order'], ['open', 'variable', 'boolean']];
  const rows = items.map(([label, role, detail], i) => {
    const sel = i === 0;
    return `<div class="sg-row" style="${sel ? `background:${c['editorSuggestWidget.selectedBackground']};color:${c['editorSuggestWidget.selectedForeground']}` : ''}">
      <span class="sg-ico" style="color:${roles[role]}">■</span><span><b style="color:${c['editorSuggestWidget.highlightForeground']}">o</b>${label.slice(1)}</span>
      <span class="sg-detail" style="color:${c.descriptionForeground}">${detail}</span></div>`;
  }).join('');
  return `<div class="suggest" style="background:${c['editorSuggestWidget.background']};border:1px solid ${c['editorSuggestWidget.border']};color:${c['editorSuggestWidget.foreground']};box-shadow:0 8px 24px ${c['widget.shadow']}">${rows}</div>`;
}

function workbench(theme, roles, rows, shot) {
  const c = theme.colors;
  const base = TREES[shot.lang];
  const tree = shot.title ? { ...base, items: base.items.map((i) => (i[4] ? [i[0], i[1], shot.title, i[3], true] : i)) } : base;
  const fileName = tree.items.find((i) => i[4])[2];
  const langLabel = { tsx: 'TypeScript JSX', rust: 'Rust', python: 'Python' }[shot.lang];
  const tabs = [[fileName, true], ...tree.items.filter((i) => i[0] === 'f' && !i[4]).slice(0, 2).map((i) => [i[2], false])];
  const tabHtml = tabs.map(([name, active], i) => `
    <div class="tab" style="background:${active ? c['tab.activeBackground'] : c['tab.inactiveBackground']};color:${active ? c['tab.activeForeground'] : c['tab.inactiveForeground']};${active ? `box-shadow: inset 0 1px ${c['tab.activeBorderTop']}` : ''}">
      <span class="dot" style="background:${roles[FILE_DOT[name.split('.').pop()]] ?? roles['fg-muted']}"></span>${name}
      ${i === 1 ? `<span class="mod" style="background:${c['tab.inactiveModifiedBorder']}"></span>` : `<span class="x">×</span>`}
    </div>`).join('');
  const acts = ['files', 'search', 'git', 'debug', 'ext'];
  const actHtml = acts.map((n, i) => `<div class="act" style="${i === 0 ? `box-shadow: inset 2px 0 ${c['activityBar.activeBorder']}` : ''}">${icon(n, i === 0 ? c['activityBar.foreground'] : c['activityBar.inactiveForeground'])}${n === 'git' ? `<span class="badge" style="background:${composite(c['activityBarBadge.background'], c['activityBar.background'])};color:${c['activityBarBadge.foreground']}">3</span>` : ''}</div>`).join('');
  const crumbs = [...tree.crumbs, fileName].join(' <span class="sep">›</span> ');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 1440px; height: 900px; overflow: hidden; background: ${c['titleBar.activeBackground']}; font: 13px ${UI_FONT}; }
    .win { display: grid; grid-template-rows: 34px 1fr 24px; height: 100%; }
    .title { display: flex; align-items: center; padding: 0 12px; background: ${c['titleBar.activeBackground']}; color: ${c['titleBar.activeForeground']}; }
    .lights { display: flex; gap: 8px; } .lights i { width: 12px; height: 12px; border-radius: 50%; display: block; }
    .cc { margin: 0 auto; width: 420px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; gap: 8px;
          background: ${c['commandCenter.background']}; color: ${c['commandCenter.foreground']}; border: 1px solid ${c['commandCenter.activeBorder']}; font-size: 12px; }
    .main { display: grid; grid-template-columns: 48px 256px 1fr; min-height: 0; }
    .activity { background: ${c['activityBar.background']}; display: flex; flex-direction: column; align-items: center; }
    .act { width: 48px; height: 48px; display: grid; place-items: center; position: relative; }
    .badge { position: absolute; right: 8px; bottom: 9px; font-size: 9px; font-weight: 700; border-radius: 8px; padding: 1px 4px; }
    .act-bottom { margin-top: auto; }
    .sidebar { background: ${c['sideBar.background']}; padding-top: 2px; }
    .sb-title { font-size: 11px; letter-spacing: .06em; padding: 10px 20px 8px; }
    .sb-head { font-size: 11px; font-weight: 700; letter-spacing: .04em; padding: 4px 8px; display: flex; gap: 6px; }
    .tree { height: 22px; display: flex; align-items: center; gap: 7px; font-size: 13px; padding-right: 12px; }
    .chev { display: inline-block; width: 10px; transform: rotate(90deg); font-size: 14px; line-height: 1; } .chev.open { color: inherit; }
    .dot { width: 8px; height: 8px; border-radius: 2px; flex: none; }
    .gitb { margin-left: auto; font-size: 11px; font-weight: 600; }
    .editor-area { display: grid; grid-template-rows: 35px 22px 1fr 210px; min-width: 0; background: ${c['editor.background']}; }
    .tabs { display: flex; background: ${c['editorGroupHeader.tabsBackground']}; }
    .tab { display: flex; align-items: center; gap: 8px; padding: 0 14px 0 12px; font-size: 13px; min-width: 120px; }
    .x { margin-left: 10px; opacity: .7; } .mod { margin-left: 12px; width: 8px; height: 8px; border-radius: 50%; }
    .crumbs { display: flex; align-items: center; gap: 6px; padding: 0 16px; font-size: 12px; color: ${c['breadcrumb.foreground']}; background: ${c['breadcrumb.background']}; }
    .sep { opacity: .7; }
    .editor { display: grid; grid-template-columns: 1fr 96px; min-height: 0; position: relative; padding-top: 4px; }
    .lines { font: 13.5px/${LINE_H}px ${CODE_FONT}; font-variant-ligatures: contextual; color: ${c['editor.foreground']}; }
    .row { height: ${LINE_H}px; display: flex; white-space: pre; }
    .ln { width: 62px; padding-right: 22px; text-align: right; flex: none; }
    .code { position: relative; display: flex; }
    .text { display: inline-block; }
    .guide { display: inline-block; width: 2ch; height: ${LINE_H}px; vertical-align: top; }
    .caret { width: 2px; height: 18px; margin-top: 1px; }
    .minimap { padding: 6px 10px 0 14px; opacity: .55; } .mm { height: 3px; margin-bottom: 1px; display: flex; gap: 1px; } .mm i { height: 2px; display: block; }
    .slider { position: absolute; right: 0; top: 4px; width: 96px; height: 120px; background: ${c['minimapSlider.background']}; }
    .panel { background: ${c['panel.background']}; display: grid; grid-template-rows: 34px 1fr; }
    .ptabs { display: flex; gap: 22px; padding: 0 20px; align-items: stretch; font-size: 11px; letter-spacing: .05em; }
    .ptab { display: flex; align-items: center; color: ${c['panelTitle.inactiveForeground']}; }
    .ptab.on { color: ${c['panelTitle.activeForeground']}; box-shadow: inset 0 -1px ${c['panelTitle.activeBorder']}; }
    .term { padding: 6px 20px; font: 13px/20px ${CODE_FONT}; color: ${c['terminal.foreground']}; background: ${c['terminal.background']}; }
    .tcursor { display: inline-block; width: 8px; height: 16px; vertical-align: -3px; }
    .status { display: flex; align-items: center; gap: 16px; padding: 0 0 0 0; font-size: 12px; background: ${c['statusBar.background']}; color: ${c['statusBar.foreground']}; }
    .remote { height: 100%; display: flex; align-items: center; padding: 0 12px; background: ${c['statusBarItem.remoteBackground']}; color: ${c['statusBarItem.remoteForeground']}; }
    .right { margin-left: auto; display: flex; gap: 18px; padding-right: 14px; }
    .suggest { position: absolute; left: 330px; top: ${4 + (shot.cursor + 1) * LINE_H + 2}px; width: 440px; border-radius: 6px; padding: 3px; font: 13px/22px ${CODE_FONT}; }
    .sg-row { display: flex; gap: 8px; padding: 0 8px; border-radius: 4px; } .sg-ico { font-size: 10px; } .sg-detail { margin-left: auto; font-size: 12px; }
  </style></head><body><div class="win">
    <div class="title">
      <div class="lights"><i style="background:${roles['git-del']}"></i><i style="background:${roles.constant}"></i><i style="background:${roles['git-add']}"></i></div>
      <div class="cc">${icon('search', c['commandCenter.foreground'], 14)} ${tree.root.toLowerCase()}</div>
    </div>
    <div class="main">
      <div class="activity">${actHtml}<div class="act act-bottom">${icon('account', c['activityBar.inactiveForeground'])}</div><div class="act">${icon('gear', c['activityBar.inactiveForeground'])}</div></div>
      <div class="sidebar">${sidebarHtml(tree, c, roles)}</div>
      <div class="editor-area">
        <div class="tabs">${tabHtml}</div>
        <div class="crumbs">${crumbs}</div>
        <div class="editor">
          <div class="lines">${editorHtml(rows, c, { from: shot.from, cursor: shot.cursor, selection: [shot.cursor - 3, shot.cursor - 2] })}</div>
          <div class="minimap">${minimapHtml(rows)}${minimapHtml(rows)}</div>
          <div class="slider"></div>
          ${shot.suggest ? suggestHtml(c, roles) : ''}
        </div>
        <div class="panel">
          <div class="ptabs"><span class="ptab">PROBLEMS</span><span class="ptab">OUTPUT</span><span class="ptab">DEBUG CONSOLE</span><span class="ptab on">TERMINAL</span></div>
          <div class="term">${terminalHtml(roles, shot.lang)}</div>
        </div>
      </div>
    </div>
    <div class="status">
      <span class="remote">⇄ main*</span>
      <span style="color:${roles.error}">⊗ 1</span><span style="color:${roles.warn}">⚠ 2</span>
      <div class="right"><span>Ln ${shot.from + shot.cursor}, Col 18</span><span>Spaces: 2</span><span>UTF-8</span><span>LF</span><span>${langLabel}</span><span>${theme.name}</span></div>
    </div>
  </div></body></html>`;
}

// ---- 4-flavor grid ------------------------------------------------------

function gridHtml(cards) {
  const card = ({ theme, roles, rows }) => {
    const c = theme.colors;
    return `<div class="card" style="background:${c['editor.background']};box-shadow:0 18px 40px ${roles.shadow}55">
      <div class="bar" style="background:${c['titleBar.activeBackground']};color:${c['titleBar.activeForeground']}">
        <span class="dots"><i style="background:${roles['git-del']}"></i><i style="background:${roles.constant}"></i><i style="background:${roles['git-add']}"></i></span>
        <span class="name" style="color:${roles['fg-bright']}">${theme.name}</span><span class="file">OrderService.ts</span>
      </div>
      <div class="lines" style="color:${c['editor.foreground']}">${editorHtml(rows, c, { from: GRID.from, cursor: 2 })}</div>
    </div>`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 1400px; height: 820px; overflow: hidden; }
    body { background: linear-gradient(135deg, #2A2522 0%, #1B1918 55%, #3A2C24 100%); display: grid; grid-template-columns: 1fr 1fr; gap: 28px; padding: 32px; font: 13px ${UI_FONT}; }
    .card { border-radius: 12px; overflow: hidden; display: grid; grid-template-rows: 36px 1fr; }
    .bar { display: flex; align-items: center; gap: 14px; padding: 0 14px; }
    .dots { display: flex; gap: 7px; } .dots i { width: 11px; height: 11px; border-radius: 50%; display: block; }
    .name { font-weight: 600; font-size: 13px; } .file { margin-left: auto; font-size: 12px; opacity: .8; }
    .lines { padding-top: 8px; font: 12.5px/${LINE_H}px ${CODE_FONT}; }
    .row { height: ${LINE_H}px; display: flex; white-space: pre; }
    .ln { width: 48px; padding-right: 18px; text-align: right; flex: none; }
    .code { position: relative; display: flex; } .text { display: inline-block; }
    .guide { display: inline-block; width: 2ch; height: ${LINE_H}px; vertical-align: top; }
    .caret { width: 2px; height: 17px; margin-top: 2px; }
  </style></head><body>${cards.map(card).join('')}</body></html>`;
}

// ---- icon ---------------------------------------------------------------

function iconHtml(roles) {
  return `<!doctype html><html><head><style>html,body{margin:0;width:256px;height:256px;background:transparent;overflow:hidden}</style></head><body>
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="sky"><rect x="0" y="0" width="256" height="156"/></clipPath><clipPath id="tile"><rect width="256" height="256" rx="56"/></clipPath></defs>
    <g clip-path="url(#tile)">
      <rect width="256" height="256" fill="${roles.bg}"/>
      <circle cx="128" cy="156" r="78" fill="${roles.accent}" clip-path="url(#sky)"/>
      <rect x="0" y="156" width="256" height="100" fill="${roles['bg-deep']}"/>
      <rect x="0" y="156" width="256" height="6" fill="${roles.number}" opacity=".55"/>
      <g stroke="${roles.type}" stroke-width="9" stroke-linecap="round">
        <line x1="58" y1="104" x2="150" y2="104"/><line x1="104" y1="126" x2="206" y2="126"/><line x1="74" y1="196" x2="182" y2="196" opacity=".6"/>
      </g>
    </g>
  </svg></body></html>`;
}

// ---- main ---------------------------------------------------------------

const flavors = Object.fromEntries(FLAVOR_IDS.map((id) => [id, buildTheme(id)]));
const highlighter = await createHighlighter({
  themes: Object.values(flavors).map(({ theme }) => theme),
  langs: ['tsx', 'rust', 'python'],
});

mkdirSync(OUT, { recursive: true });
try {
  for (const shot of SHOTS) {
    const { theme, roles } = flavors[shot.flavor];
    capture(workbench(theme, roles, tokenWindow(highlighter, shot, theme.name), shot), shot.out, 1440, 900);
  }
  const cards = ['dark', 'night', 'mist', 'light'].map((id) => ({ ...flavors[id], rows: tokenWindow(highlighter, GRID, flavors[id].theme.name) }));
  capture(gridHtml(cards), GRID.out, 1400, 820);
  capture(iconHtml(flavors.dark.roles), 'icon.png', 256, 256, 1);
} finally {
  rmSync(WORK, { recursive: true, force: true });
}
if (!existsSync(join(OUT, 'icon.png'))) process.exit(1);
