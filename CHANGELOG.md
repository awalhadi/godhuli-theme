# Changelog

## 0.2.0 — 2026-10-29

- **Borderless unified chrome.** The title bar, activity bar, sidebar, tabs, panel, terminal and status bar now share one plane, 3 L\* below the editor. Pane hairlines are gone.
- Active tab merges into the editor. Inactive tabs, breadcrumbs and panel titles use the new `fg-dim` role (Lc ≈ 40, up from 30).
- Tinted badges, neutral list selection, softer focus ring and widget shadows.
- Night: identifier contrast capped at Lc 78 to limit OLED halation; bright ANSI colors softened.
- Light: lower-glare paper (L\* 96 → 94) and softer ink (Lc 89 → 85).
- New gates: unified chrome, plane step, Night halation cap, Light glare cap, opaque-base guard for composited checks.
- Marketplace metadata (pricing, repository, bugs, homepage) and `package`/`publish:vscode`/`publish:ovsx` scripts. Added PUBLISHING.md.
- Marketplace SEO: keyword-first display name and description, 30 intent tags, README rewritten as a landing page (benefits, flavors, install, comparisons, FAQ). Added MARKETING.md growth playbook.
- Generated Marketplace images (`npm run screenshots`): hero workbench, Night/Mist/Light galleries, 4-flavor comparison grid and the ember-sun icon, all rendered from the tokens with Shiki and headless Chrome.

## 0.1.0 — 2026-10-29

- Initial release: Godhuli Dark, Night, Mist and Light.
- Token pipeline (`tokens/` → `scripts/build.mjs` → `themes/`) with a single hex source.
- Quality gate (`scripts/check.mjs`): APCA contrast, selection/diff/find composites, CVD separation, role parity, theme freshness.
- Full semantic token map, ~160 TextMate rules (TS/TSX, JS, Python, Rust, Go, C/C++, C#, PHP/Blade, SQL, Shell, HTML, CSS/SCSS/Less, JSON, YAML, TOML, dotenv, Markdown, diff, git, logs) and ~770 workbench colors.
