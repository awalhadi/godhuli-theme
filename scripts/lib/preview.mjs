// The preview corpus: every file under preview/ with the Shiki (VS Code TextMate) grammar that highlights it.
import { readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { bundledLanguages } from 'shiki';
import { ROOT } from './tokens.mjs';

export const PREVIEW = join(ROOT, 'preview');

// Extension (or whole filename) -> Shiki language id, for names Shiki can't infer.
const BY_NAME = {
  Dockerfile: 'dockerfile', Makefile: 'makefile', COMMIT_EDITMSG: 'git-commit', 'git-rebase-todo': 'git-rebase',
  '.htaccess': 'apache', 'CMakeLists.txt': 'cmake', '.env.example': 'dotenv', '.env': 'dotenv',
};
const BY_SUFFIX = [
  ['.blade.php', 'blade'], ['.html.twig', 'twig'], ['.html.erb', 'erb'], ['.component.html', 'angular-html'],
  ['.component.ts', 'angular-ts'], ['.d.ts', 'typescript'],
];
const BY_EXT = {
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.ts': 'typescript', '.jsx': 'jsx', '.tsx': 'tsx',
  '.py': 'python', '.rs': 'rust', '.md': 'markdown', '.diff': 'diff', '.sh': 'shellscript', '.zsh': 'zsh',
  '.fish': 'fish', '.ps1': 'powershell', '.bat': 'bat', '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'toml',
  '.ini': 'ini', '.properties': 'properties', '.json': 'json', '.json5': 'json5', '.php': 'php', '.vue': 'vue',
  '.svelte': 'svelte', '.astro': 'astro', '.html': 'html', '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.sass': 'sass', '.hbs': 'handlebars', '.pug': 'pug', '.liquid': 'liquid', '.jinja': 'jinja', '.svg': 'xml',
  '.xml': 'xml', '.graphql': 'graphql', '.java': 'java', '.kt': 'kotlin', '.scala': 'scala', '.groovy': 'groovy',
  '.cs': 'csharp', '.fs': 'fsharp', '.vb': 'vb', '.go': 'go', '.c': 'c', '.cpp': 'cpp', '.m': 'objective-c',
  '.zig': 'zig', '.rb': 'ruby', '.ex': 'elixir', '.erl': 'erlang', '.hs': 'haskell', '.ml': 'ocaml',
  '.clj': 'clojure', '.lua': 'lua', '.pl': 'perl', '.R': 'r', '.jl': 'julia', '.swift': 'swift', '.dart': 'dart',
  '.sol': 'solidity', '.sql': 'sql', '.plsql': 'plsql', '.prisma': 'prisma', '.proto': 'proto', '.csv': 'csv',
  '.log': 'log', '.http': 'http', '.mdx': 'mdx', '.tex': 'latex', '.tf': 'hcl', '.nix': 'nix', '.conf': 'nginx',
  '.frag': 'glsl', '.wgsl': 'wgsl', '.txt': null,
};
// Django templates are HTML files with template tags; jinja highlights them faithfully.
const BY_PATH = [[/django\/.*\.html$/, 'jinja']];

export function langFor(path) {
  const name = basename(path);
  const rel = relative(PREVIEW, path);
  for (const [re, lang] of BY_PATH) if (re.test(rel)) return lang;
  if (name in BY_NAME) return BY_NAME[name];
  for (const [suffix, lang] of BY_SUFFIX) if (name.endsWith(suffix)) return lang;
  return BY_EXT[extname(name)] ?? null;
}

export const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

// { files: [{ path, rel, lang }], skipped: [rel] }
export function previewFiles() {
  const all = walk(PREVIEW).sort();
  const files = all
    .map((path) => ({ path, rel: relative(PREVIEW, path), lang: langFor(path) }))
    .filter((f) => f.lang && f.lang in bundledLanguages);
  const kept = new Set(files.map((f) => f.path));
  return { files, skipped: all.filter((p) => !kept.has(p)).map((p) => relative(PREVIEW, p)) };
}
