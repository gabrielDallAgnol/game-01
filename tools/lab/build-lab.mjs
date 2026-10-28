// Bundles the Atom Lab (tools/lab/main.js + the engine) into one self-contained page,
// with the same module rules as tools/build.mjs.   node tools/lab/build-lab.mjs [out] [entry.js page.html]
// (the Looks Lab: node tools/lab/build-lab.mjs dist/looks.html tools/lab/looks.js tools/lab/looks.html)
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
const entry = path.resolve(root, process.argv[3] || 'tools/lab/main.js'), page = path.resolve(root, process.argv[4] || 'tools/lab/atomlab.html');
visit(entry);
const bundle = `(function () {\n'use strict';\nconst __m = {};\n${order.map(f => mods.get(f)).join('\n\n')}\n})();`;
const html = fs.readFileSync(page, 'utf8');
const tagRe = new RegExp(`<script type="module" src="\\./[^"]*${path.basename(entry).replace('.', '\\.')}"></script>`), tag = (html.match(tagRe) || [''])[0];
if (!tag) throw new Error(`${path.basename(page)} is missing the module entry tag ${tag}`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html.replace(tag, () => `<script>\n${bundle}\n</script>`));
console.log(`wrote ${rel(out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${order.length} modules)`);
