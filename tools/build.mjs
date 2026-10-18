// Zero-dependency bundler: inlines the ES modules under src/ into index.html as one
// classic script, so the game ships as a single self-contained page.
//   node tools/build.mjs [out=dist/index.html]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = process.argv[2] || path.join(root, 'dist/index.html');
const mods = new Map(), order = [];

function visit(file) {
  if (mods.has(file)) return;
  mods.set(file, null);
  let code = fs.readFileSync(file, 'utf8');
  const exportsList = [];
  code = code.replace(/^import\s+\{([^}]*)\}\s+from\s+'([^']+)';?[ \t]*$/gm, (_, names, spec) => {
    const dep = path.resolve(path.dirname(file), spec); visit(dep);
    const fields = names.split(',').map(s => s.trim()).filter(Boolean).map(s => s.replace(/^(\w+)\s+as\s+(\w+)$/, '$1: $2')).join(', ');
    return `const { ${fields} } = __m[${JSON.stringify(rel(dep))}];`;
  });
  if (/^import\s/m.test(code)) throw new Error(`Unsupported import form in ${rel(file)}`);
  code = code.replace(/^export\s+(async\s+function|function|const|let|class)\s+(\w+)/gm, (_, kw, name) => { exportsList.push(name); return `${kw} ${name}`; });
  code = code.replace(/^export\s+\{([^}]*)\};?[ \t]*$/gm, (_, names) => { names.split(',').map(s => s.trim()).filter(Boolean).forEach(n => exportsList.push(n)); return ''; });
  if (/^export\s/m.test(code)) throw new Error(`Unsupported export form in ${rel(file)}`);
  mods.set(file, `__m[${JSON.stringify(rel(file))}] = (function () {\n${code}\nreturn { ${exportsList.join(', ')} };\n})();`);
  order.push(file);
}
const rel = f => path.relative(root, f);

visit(path.join(root, 'src/main.js'));
const bundle = `(function () {\n'use strict';\nconst __m = {};\n${order.map(f => mods.get(f)).join('\n\n')}\n})();`;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const tag = '<script type="module" src="./src/main.js"></script>';
if (!html.includes(tag)) throw new Error('index.html is missing the module entry tag');
fs.mkdirSync(path.dirname(out), { recursive: true });
// classic vendor scripts (three.js helpers) are inlined in place
const withVendor = html.replace(/<script src="\.\/vendor\/([\w.-]+\.js)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(path.join(root, 'vendor', f), 'utf8')}\n</script>`);
fs.writeFileSync(out, withVendor.replace(tag, () => `<script>\n${bundle}\n</script>`));
console.log(`${order.length} modules → ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
