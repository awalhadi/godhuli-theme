# Changelog

## 0.3.1 — 2026-11-02

**Fixed**
- **Find matches hid their text.** `editor.findMatchForeground` was `transparent`, and VS Code paints that literally, so the current match (and, depending on the token, other matches) showed an empty box, e.g. `tracking` inside a Tailwind `className` string. The key is removed, so matches keep their syntax color.
- **Selected text could vanish** in High Contrast (`editor.selectionForeground`) and in the terminal (`terminal.selectionForeground`) for the same reason. Both keys are removed.
- New gates: no `*Foreground` color may be fully transparent, and strings on the current find match must read at Lc 55+. To meet it, the current-match fill on dark flavors drops from 38% to 30% opacity; its solid border still marks the match.

## 0.3.0 — 2026-11-01

**New theme.** Existing theme ids are unchanged.
- **Godhuli High Contrast** (`hc-black`): for low vision, glare, projectors and screen sharing.
  - Every syntax role reads at APCA Lc 65+ (identifiers 96, control flow 95, strings 87). Comments stay readable at 61 but remain the quietest text.
  - Visible borders and focus rings, a deep umber canvas (not `#000`), and stronger selection, find and diff overlays.
  - Error/warning underline borders add a cue beyond color.
  - Same hue families and the same CVD-separation gates as every other flavor.

**Semantic highlighting, verified against real language servers.** The new `npm run semantic` dumps the tokens that TypeScript, Intelephense, Pylance, rust-analyzer and Volar actually emit and resolves them with VS Code's own selector scoring. It found and fixed:
- **TS/JS constants:** `ALL_CAPS` module constants lost their amber color under semantic highlighting. `variable.readonly` is now constant, while `const` locals stay plain.
- **Python:**
  - `self`/`cls` declarations rendered as sand parameters (`parameter.declaration` outscored `selfParameter`).
  - Built-ins (`str`, `dict`, `len`, `__name__`) used user colors, because Pylance marks them `builtin`, not `defaultLibrary`.
  - Decorators (`@dataclass`, `@property`) turned blue instead of macro rose.
  - String escapes lost their color.
  - Dunder methods fell back to plain functions.
- **PHP:** heredoc interpolation braces (which Intelephense marks `decorator`) now use the interpolation accent.
- **Rust:**
  - Associated `const`s are constant.
  - `unsafe` uses the warning style.
  - `*.mutable` bindings get rust-analyzer's underline convention.
- **Composable styles:** semantic styles now use composable boolean flags instead of `fontStyle` strings, which silently switched off underline/strikethrough from other modifiers.

**Comfort & focus gates.** All existing gates are unchanged.
- **Color budget** (`npm run scopes`): counts the non-neutral hue families per line across 7,186 lines of real code. The baseline gate is p95 ≤ 3 and max ≤ 5, and 84% of lines use two or fewer. `scopes` now exits non-zero on a budget breach or invented scope and runs in `vscode:prepublish`.
- **Salience:**
  - Comments and punctuation recede ≥ 5 Lc below every code color.
  - Control flow ≥ keywords + 5.
  - Operators sit above punctuation.
  - Error is the most saturated diagnostic.
- **Cursor & diagnostics:**
  - The caret is legible on the current line (≥ 60) and over selections (≥ 45), and secondary cursors are distinct.
  - Error/warning/info/hint squiggles are ≥ 50.
  - Error vs warning stay distinct under every CVD simulation; this fixed Mist (8.3 → 15.8) and Light (10.4 → 14.7).
- **High-contrast profile:** stricter text floors and visible-border gates.

**Docs & tooling.**
- **README:** High Contrast section, a "which flavor when" guide, optional comfort settings (cursor animation, letter spacing, terminal font), and a contrast table with an HC column.
- **New image:** `images/high-contrast.png` (Laravel Blade + Alpine).
- **Audit sheets:** `npm run screenshots -- --audit` now covers all five flavors and takes `--only <path>`.

**Syntax colors.** These are role-based refinements; the dusk identity is unchanged.
- **Punctuation:** now a quiet cool slate, so commas and braces no longer look like comment text (ΔE vs comments 2.8 → 15).
- **Regular expressions:** moved from pink to jade, so they no longer collide with decorators and macros (they were indistinguishable under CVD simulation).
- **Functions, methods and built-ins:** now three clear steps (bright blue / lighter cyan-blue / muted). Before, methods were barely distinguishable from functions.
- **Built-in types and namespaces:** separated by lightness, so they survive color-vision simulation.
- **Control flow vs. keywords:** control flow is brighter orchid, kept apart from other keywords under every CVD simulation.
- **Interfaces and traits:** now italic (abstract contracts); declarations stay bold.
- **Generic type parameters:** new `type-param` role, in the parameter sand family (`T` is a type-level parameter).
- **Inlay hints:** now teal-gray, distinct from both warm comments and cool ghost text.
- **Light:** the same separation rebuilt for paper. **Mist:** gets targeted overrides so its softness never drops below its contrast targets.
- **Less bold:** removed from escapes, interpolation braces, f-string braces, Go format verbs, `!important` and invalid code; color carries them. Bold now means declarations, headings and TODO tags only.
- **Fixed:**
  - Markdown H3–H6 never got their own color.
  - CSV columns 4 and 10 rendered as a comment and an error.
  - Alpine `@click=`/`:class=` inside Blade rendered as illegal HTML.

**Rule hygiene.**
- **Conflicting scopes resolved:** 4 conflicting and 7 redundant duplicate scope owners. These cover `storage.type.function.arrow`, `support.variable.magic.python`, `punctuation.accessor`, `entity.name.section.group-title.ini`, the Rust attribute/macro/self scopes, the Go package scope, the preprocessor scope and the f-string scope.
- **Invented scopes removed:** 41 selectors that no installed grammar emits.
- **New rules, only for verified grammar scopes:**
  - Templates: Jinja/Django/Twig delimiters, Blade directive parens
  - Data and config formats: JSON5 numbers, CSS keyframe offsets, PHP enum cases, `.env` values, HTTP request files, Apache, nginx, CMake, Protobuf, CSV columns
  - Languages: Clojure, Lua metamethods, C++ attributes, F#/Scala namespaces, GraphQL fragments/scalars, LaTeX sections
- **Semantic tokens:**
  - New selectors: `typeParameter`, `clsParameter`, `builtinAttribute`, `constParameter` and `operator.controlFlow`.
  - Interfaces and traits are italic.
  - `*.deprecated` keeps the symbol's color and only strikes it through. The build now supports semantic styles without a color.

**Workbench.** 26 newer VS Code color keys:
- activity error/warning badges
- testing coverage minimap and message peek
- comment widgets
- gutter items
- chat diff counts
- quick input focus
- `strongForeground`

Code lens text and suggest match highlights on the selected row are now more legible.

**Quality gates.** All existing gates are unchanged; new ones were added.
- **Rule hygiene:** one owner per TextMate scope, and semantic selectors validated against known token types and modifiers.
- **Side-by-side syntax separation:** 13 pairs, worst case across normal/protan/deutan/tritan.
- **CVD pair:** control vs keyword.
- **16 new composited-contrast checks:** inactive selection, word highlight, find-in-selection, bracket match, sticky scroll, peek, merge current/incoming, diff lines, suggest highlight, ghost text on the current line, code lens and hover code blocks.

**Tooling & samples.**
- **`npm run scopes`:** tokenizes the preview corpus with VS Code's grammars and reports which rule wins for every token, unstyled scopes, dead rules and invented selectors. `--write` generates `docs/LANGUAGES.md`.
- **`npm run screenshots -- --audit`:** renders every sample in all four flavors for visual review.
- **Preview corpus:** grew from 6 files to 129 realistic samples across 85 languages and frameworks. Includes Laravel, Blade, Symfony/Twig, Next.js, Vue, Nuxt, Angular, Svelte, Astro, NestJS, Django, FastAPI, Spring Boot, ASP.NET, Rails, Phoenix, Flutter, SwiftUI, Docker, Kubernetes, Terraform, GitHub Actions and more.
- **Images:** the Light screenshot now shows a Laravel controller.

**Docs.**
- **README rewritten:** design philosophy and role table, inspiration positioning (no affiliation claimed), optional font settings, accessibility section, development guide.
- **Placeholder links fixed** to `NotifyX.godhuli-theme` (verified on the Marketplace and Open VSX).
- **Claims softened:** "designed for visual comfort" and "CVD-tested" instead of eye-strain or colorblind-safe promises.

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
