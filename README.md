# Godhuli

**Godhuli** (গোধূলি, "cow-dust hour") is the dusk between day and night. It's the hour when the light turns warm and the sky still holds its blue.

This VS Code theme family is built around that light. The canvas is warm umber-gray, structure is cool twilight blue and teal, literals are warm ember, turmeric and sage, and one ember accent is used sparingly. The aim is that the editor fades into the background while the code stays legible.

| Flavor | Canvas | For |
|---|---|---|
| **Godhuli Dark** | `#24211F` (L\* 13) | The default. LCD monitors, long sessions |
| **Godhuli Night** | `#161413` (L\* 6.5) | OLED and dark rooms. Deeper canvas, with identifier contrast capped to limit halation |
| **Godhuli Mist** | `#282624` (L\* 15) | Lowest chroma and softest contrast, for when your eyes are tired |
| **Godhuli Light** | `#F3EEE4` (L\* 94) | Warm, low-glare paper. Designed separately, not an inverted dark theme |

## Design principles

- **Borderless and unified.** The title bar, activity bar, sidebar, tab strip, panel, terminal and status bar share **one** quiet chrome plane. The editor sits 3 L\* above it, so panes are separated by light rather than lines. Hairlines remain only where two equal planes meet: split editors and the diff editor.
- **The editor is the brightest working plane.** The active tab becomes part of the editor, with a thin ember top edge. Inactive tabs stay readable (Lc ≈ 40) without competing.
- **Calm chrome.** Badges are tinted rather than solid. Sidebar and list selections are neutral, and only the editor and terminal selection use the cool slate. Floating widgets sit on a raised plane with soft shadows.
- **Color marks levels of importance, not a rainbow.**
  - Identifiers are the brightest text (Lc ≈ 80).
  - Control flow (`if`, `return`, `await`, `yield`) is dusk orchid and outranks other keywords, which are mauve.
  - Types are teal and declarations are bold. Functions are azure.
  - Strings are sage, constants turmeric, numbers ember.
  - Punctuation is quiet (Lc ≈ 46), and comments read clearly but stay in the background (Lc ≈ 48).
- **A chroma budget.** Large surfaces stay at C\* ≤ 3 (Light paper ≤ 5). Syntax uses C\* 25–40. The highest chroma is reserved for errors, debug, git conflicts and the ember accent.
- **Comfort is measured, not eyeballed.** Every contrast target in the brief is checked by APCA in `npm run check`. That includes contrast after selection, diff, find match and current-line backgrounds are layered underneath.
- **Meaning survives color-vision deficiency.** Protanopia, deuteranopia and tritanopia are simulated with Machado 2009 matrices:
  - Added vs deleted lines and passed vs failed tests differ in **lightness**, not just red vs green.
  - Type vs string, function vs type, and keyword vs function keep a measured ΔE.
  - Errors also carry an undercurl, bold `invalid` tokens and icons.

## Contrast summary (APCA Lc vs editor background)

| Role | Dark | Night | Mist | Light | Target |
|---|---:|---:|---:|---:|---|
| Identifiers (`fg`) | 79.9 | 76.1 | 74.8 | 85.2 | 75–90 (Mist 69+, Night ≤ 78) |
| Strings | 71.1 | 72.7 | 70.3 | 72.4 | ≥ 70 |
| Control flow | 69.9 | 71.4 | 69.3 | 75.7 | > keywords |
| Types | 66.3 | 67.9 | 65.3 | 72.1 | ≥ 60 |
| Functions | 65.6 | 67.2 | 64.6 | 74.2 | ≥ 60 |
| Keywords | 59.7 | 61.3 | 59.0 | 68.7 | ≥ 58 |
| Punctuation | 46.3 | 47.9 | 45.4 | 56.1 | 44–60, ≥ 15 below fg |
| Comments | 48.5 | 48.0 | 47.8 | 51.1 | 45–60 |

Selection is cool slate at about 36% alpha, so it stays visible on warm tokens. On a selected line, identifiers keep Lc ≥ 72, strings ≥ 64 and comments ≥ 41. The full per-role tables (hex, L\*, C\*, h°, Lc for all four flavors) are in [docs/PALETTE.md](docs/PALETTE.md).

## What's dimmed and what stands out

1. **Dimmed:** chrome. One borderless plane below the editor, with muted text. The status bar only becomes a solid color while debugging (ember).
2. **Dimmed:** punctuation and operators. They're cool gray, about 30 Lc below identifiers. You can see them, but they don't compete with names.
3. **Dimmed:** raw Markdown syntax (`#`, `**`, `[]()`, fences) and diff/HTML tag brackets are drawn in subtle neutrals.
4. **Dimmed:** comments are warm-gray italic at Lc ≈ 48, readable at a glance and never invisible. Docstrings and JSDoc sit a step brighter, with tags in mauve.
5. **Dimmed:** inactive indent guides, whitespace and rulers sit barely above the canvas. The active indent guide is a clear step brighter.
6. **Stands out:** control flow. `return`, `await`, `yield`, `if` and `throw` are orchid, the strongest keyword color, so the shape of the logic shows at a glance.
7. **Stands out:** declarations. Class, interface, type, enum and struct names are bold teal where they're defined. Built-in types are a lighter, softer teal.
8. **Stands out:** template interpolation and escapes. `${}`, f-string braces and `\n` are ember/turmeric bold inside sage strings.
9. **Stands out:** JSX components are teal like types, HTML tags are terracotta and attributes are gold italic. A component never looks like a tag or a string.
10. **Stands out:** diagnostics and the cursor. Errors are coral with an undercurl, the cursor is warm gold, and find matches are amber, with the current match given a solid border to tell it apart from other matches.

Suggestions from AI completion, inline completion and other "ghost text" are **cool gray and upright**. That keeps them distinct from comments (warm italic) and inlay hints (warm gray on a chip).

## Screenshots

_Add screenshots before publishing. Take them from the files in `preview/`, save them as PNG in `images/`, push them to GitHub, and link them here by **HTTPS URL**. The Marketplace rejects SVG and HTTP images in the README._

<!-- ![Godhuli Dark](https://raw.githubusercontent.com/your-name/godhuli-theme/main/images/dark.png) -->

## Install

From source:

1. Open this folder in VS Code and press <kbd>F5</kbd> to open an Extension Development Host, **or** run **Developer: Install Extension from Location…** and pick this folder.
2. Run **Preferences: Color Theme** and choose one of the four Godhuli flavors.
3. Open the files in `preview/` (`.tsx`, `.py`, `.rs`, `.md`, `.diff`) and run `bash preview/ansi.sh` in the terminal.
4. Use **Developer: Inspect Editor Tokens and Scopes** to see which semantic or TextMate rule is coloring a token.

Recommended settings:

```jsonc
{
  "editor.semanticHighlighting.enabled": true,
  "editor.bracketPairColorization.enabled": true,
  "editor.guides.bracketPairs": "active",
  "editor.fontLigatures": true
}
```

## Architecture

```
tokens/
  palette.json    the ONLY place hex is written: per-flavor roles (bg, fg, keyword, git-add, …)
  workbench.json  ~770 VS Code UI colors → roles (with optional @alpha, per-polarity values)
  semantic.json   LSP semantic tokens → roles + fontStyle
  syntax.json     ~160 TextMate scope rules → roles + fontStyle
scripts/
  lib/color.mjs   sRGB↔CIELAB/LCh, compositing, APCA, CVD simulation (no dependencies)
  lib/tokens.mjs  resolves flavors (extends / chroma / keepChroma / =aliases) into themes
  build.mjs       writes themes/godhuli-*.json
  check.mjs       quality gate; exits 1 on any failure
themes/           generated — never edit by hand
```

- **Flavors inherit.**
  - Night `extends` Dark with a deeper set of neutrals.
  - Mist `extends` Dark with `chroma: 0.62`. Brackets, git, diagnostics and the accent are listed in `keepChroma`, so status signals don't wash out.
  - Light is authored independently. Its hues are deepened for paper, not inverted.
- **Roles alias each other.** For example, `"warn": "=constant"` and `"string-interp": "=accent"`. Changing one hex in `palette.json` updates every place that role is used.

Workflow:

```sh
npm run build   # tokens → themes/*.json
npm run check   # APCA + selection/diff composites + CVD + parity + validity gates
npm run docs    # check, then regenerate docs/PALETTE.md
```

`check` also fails if `themes/*.json` are out of date with `tokens/`.

## Icon (to be drawn)

An ember half-sun (`#E9AC72`) setting behind a flat umber horizon band (`#24211F` on `#1B1918`). Three short teal (`#87CDC0`) horizontal strokes drift across the sun: the "cow dust" catching the last light. Flat, geometric, no gradients, legible at 16 px. Ship it as `icon.png` (256×256) and add `"icon": "icon.png"` to `package.json`.

## Publishing

See [PUBLISHING.md](PUBLISHING.md) for the full VS Code Marketplace and Open VSX guide.

## License

MIT
