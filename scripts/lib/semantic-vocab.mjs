// Semantic selectors: standard VS Code types/modifiers plus those emitted by common language servers
// (rust-analyzer, Pylance, clangd, gopls, C#, Java). Catches typos that would silently never match.
export const SEMANTIC_TYPES = new Set([
  'namespace', 'class', 'enum', 'interface', 'struct', 'typeParameter', 'type', 'parameter', 'variable', 'property',
  'enumMember', 'decorator', 'event', 'function', 'method', 'macro', 'label', 'comment', 'string', 'keyword', 'number',
  'regexp', 'operator', 'module', 'typeAlias', 'union', 'trait', 'builtinType', 'lifetime', 'selfKeyword',
  'selfTypeKeyword', 'selfParameter', 'clsParameter', 'formatSpecifier', 'escapeSequence', 'attribute', 'derive',
  'builtinAttribute', 'deriveHelper', 'boolean', 'builtinConstant', 'constParameter', 'unresolvedReference',
  'character', 'generic', 'toolModule', 'concept', 'modifier', 'record', 'recordStruct', 'annotation',
  'annotationMember', 'magicFunction', 'constant', 'punctuation', 'attributeBracket', 'const', 'static', '*',
]);
export const SEMANTIC_MODIFIERS = new Set([
  'declaration', 'definition', 'readonly', 'static', 'deprecated', 'abstract', 'async', 'modification',
  'documentation', 'defaultLibrary', 'controlFlow', 'mutable', 'consuming', 'unsafe', 'callable', 'constant',
  'injected', 'intraDocLink', 'library', 'public', 'reference', 'trait', 'associated', 'crateRoot', 'builtin',
  'typeHint', 'overridden', 'virtual', 'fileScope', 'classScope', 'functionScope', 'globalScope', 'format', 'local',
  'classMember', 'decorator', 'keywordArgument', 'escapeCharacter', 'dynamicAttribute', 'attribute', 'macro',
]);
