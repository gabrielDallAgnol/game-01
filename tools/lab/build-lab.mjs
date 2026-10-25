// Bundles the Atom Lab (tools/lab/main.js + the engine) into one self-contained page,
// with the same module rules as tools/build.mjs.   node tools/lab/build-lab.mjs [out]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const out = process.argv[2] || path.join(root, 'dist/atomlab.html');
const mods = new Map(), order = [], rel = f => path.relative(root, f);
function visit(file) {
  if (mods.has(file)) return; mods.set(file, null);
  let code = fs.readFileSync(file, 'utf8'); const ex = [];
  code = code.replace(/^import\s+\{([^}]*)\}\s+from\s+'([^']+)';?[ \t]*$/gm, (_, names, spec) => { const dep = path.resolve(path.dirname(file), spec); visit(dep); const f = names.split(',').map(s => s.trim()).filter(Boolean).map(s => s.replace(/^(\w+)\s+as\s+(\w+)$/, '$1: $2')).join(', '); return `const { ${f} } = __m[${JSON.stringify(rel(dep))}];`; });
  if (/^import\s/m.test(code)) throw new Error(`Unsupported import form in ${rel(file)}`);
  code = code.replace(/^export\s+(async\s+function|function|const|let|class)\s+(\w+)/gm, (_, kw, n) => { ex.push(n); return `${kw} ${n}`; });
  code = code.replace(/^export\s+\{([^}]*)\};?[ \t]*$/gm, (_, n) => { n.split(',').map(s => s.trim()).filter(Boolean).forEach(x => ex.push(x)); return ''; });
  if (/^export\s/m.test(code)) throw new Error(`Unsupported export form in ${rel(file)}`);
  mods.set(file, `__m[${JSON.stringify(rel(file))}] = (function () {\n${code}\nreturn { ${ex.join(', ')} };\n})();`); order.push(file);
}
visit(path.join(root, 'tools/lab/main.js'));
const bundle = `(function () {\n'use strict';\nconst __m = {};\n${order.map(f => mods.get(f)).join('\n\n')}\n})();`;
const html = fs.readFileSync(path.join(root, 'tools/lab/atomlab.html'), 'utf8');
const tag = '<script type="module" src="./main.js"></script>';
if (!html.includes(tag)) throw new Error('atomlab.html is missing the module entry tag');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html.replace(tag, () => `<script>\n${bundle}\n</script>`));
console.log(`wrote ${rel(out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${order.length} modules)`);
