// Opens each file listed in GODHULI_PROBE_FILES, waits for its language server, decodes the semantic tokens it
// emits and writes them to GODHULI_PROBE_OUT, then quits. Does nothing unless launched by scripts/semantic.mjs.
const fs = require('node:fs');
const vscode = require('vscode');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const WAIT_SECONDS = Number(process.env.GODHULI_PROBE_WAIT ?? 45);

async function probe(file) {
  const uri = vscode.Uri.file(file);
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, { preview: false });
  const entry = { file, lang: doc.languageId, legend: null, tokens: [] };
  for (let t = 0; t < WAIT_SECONDS; t++) {
    const legend = await vscode.commands.executeCommand('vscode.provideDocumentSemanticTokensLegend', uri);
    const result = legend && (await vscode.commands.executeCommand('vscode.provideDocumentSemanticTokens', uri));
    if (result?.data?.length) {
      entry.legend = legend;
      let line = 0;
      let char = 0;
      for (let i = 0; i < result.data.length; i += 5) {
        const [dLine, dChar, length, type, mods] = result.data.slice(i, i + 5);
        line += dLine;
        char = dLine ? dChar : char + dChar;
        entry.tokens.push({
          line: line + 1,
          text: doc.getText(new vscode.Range(line, char, line, char + length)),
          type: legend.tokenTypes[type],
          modifiers: legend.tokenModifiers.filter((_, bit) => mods & (1 << bit)),
        });
      }
      break;
    }
    await sleep(1000);
  }
  return entry;
}

exports.activate = async () => {
  const out = process.env.GODHULI_PROBE_OUT;
  if (!out) return;
  const report = [];
  for (const file of JSON.parse(process.env.GODHULI_PROBE_FILES)) {
    try {
      report.push(await probe(file));
    } catch (error) {
      report.push({ file, error: String(error), tokens: [] });
    }
  }
  fs.writeFileSync(out, JSON.stringify(report));
  await vscode.commands.executeCommand('workbench.action.quit');
};
