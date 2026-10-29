// Generates themes/godhuli-*.json from tokens/. Run: npm run build
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FLAVOR_IDS, ROOT, buildTheme, themeFile } from './lib/tokens.mjs';

mkdirSync(join(ROOT, 'themes'), { recursive: true });

for (const id of FLAVOR_IDS) {
  const { theme } = buildTheme(id);
  writeFileSync(join(ROOT, themeFile(id)), `${JSON.stringify(theme, null, 2)}\n`);
  console.log(
    `${themeFile(id).padEnd(28)} ${Object.keys(theme.colors).length} colors · ` +
      `${Object.keys(theme.semanticTokenColors).length} semantic · ${theme.tokenColors.length} token rules`,
  );
}
