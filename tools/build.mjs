// Zero-dependency bundler: inlines the ES modules under src/ into index.html as one
// classic script, so the game ships as a single self-contained page.
//   node tools/build.mjs [out=dist/index.html]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2), withGltf = args.includes('--gltf');   // [assets3] --gltf: also embed the GLTF loader and the test GLBs (only then; the default build is unchanged)
const withArea = (args.find(a => a.startsWith('--area=')) || '').slice(7);   // [area] --area=<recipe>: the run starts in that engine-built town
const withCombat2 = args.includes('--v2combat');   // [combat2] --v2combat: telegraphed bites and the dash on by default
const withV2 = args.includes('--v2');   // [v2] --v2: the V2 core (the old systems switched off) on by default
const withTop = args.includes('--top');   // [top] --top: the top-down view on by default (dist/top.html; ?top=0 turns it off)
const out = args.find(a => !a.startsWith('--')) || path.join(root, withGltf ? 'dist/index-gltf.html' : withArea ? 'dist/area.html' : withTop ? 'dist/top.html' : 'dist/index.html');
const mods = new Map(), order = [];

function visit(file) {
  if (mods.has(file)) return;
  mods.set(file, null);
  let code = fs.readFileSync(file, 'utf8');
  // [gemini3] the build time on the start screen (src/version.js keeps 'dev'; only the bundle gets the stamp)
  if (rel(file) === 'src/version.js') code = code.replace("time: 'dev'", () => `time: '${new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 16)}'`);
  // [top] begin
  if (withTop && rel(file) === 'src/render/top.js') { const c0 = code; code = code.replace('export const TOP_FLAG = false;', 'export const TOP_FLAG = true;'); if (c0 === code) throw new Error('--top: TOP_FLAG not found'); }
  // [top] end
  // [area] begin
  if (withArea && rel(file) === 'src/ui/area-flag.js') { const c0 = code; code = code.replace("export const AREA_FLAG = '';", `export const AREA_FLAG = '${withArea}';`); if (c0 === code) throw new Error('--area: AREA_FLAG not found'); }
  // [area] end
  // [combat2] begin
  if (withCombat2 && rel(file) === 'src/ui/combat2-flag.js') { const c0 = code; code = code.replace('export const COMBAT2_FLAG = false;', 'export const COMBAT2_FLAG = true;'); if (c0 === code) throw new Error('--v2combat: COMBAT2_FLAG not found'); }
  // [combat2] end
  // [v2] begin
  if (withV2 && rel(file) === 'src/ui/v2-flag.js') { const c0 = code; code = code.replace('export const V2_FLAG = false;', 'export const V2_FLAG = true;'); if (c0 === code) throw new Error('--v2: V2_FLAG not found'); }
  // [v2] end
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
// [assets3] begin: GLTFLoader + SkeletonUtils (r128, MIT) and the trimmed GLBs as base64, for ?gltf=1
const gltfBlock = !withGltf ? '' : ['GLTFLoader.js', 'SkeletonUtils.js'].map(f => `<script>\n${fs.readFileSync(path.join(root, 'vendor', f), 'utf8')}\n</script>\n`).join('')
  + `<script>window.__GLB = {${['knight', 'skeleton'].map(n => `${n}: "${fs.readFileSync(path.join(root, 'assets/models', n + '.glb')).toString('base64')}"`).join(', ')}};</script>\n`;
// [assets3] end
fs.writeFileSync(out, withVendor.replace(tag, () => `${gltfBlock}<script>\n${bundle}\n</script>`));
console.log(`${order.length} modules → ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
