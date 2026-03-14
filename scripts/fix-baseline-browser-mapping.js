const fs = require('fs');
const path = require('path');

function patchBaselineBrowserMapping() {
  const root = process.cwd();
  const packageRoot = path.join(root, 'node_modules', 'baseline-browser-mapping');
  const cjsPath = path.join(packageRoot, 'dist', 'index.cjs');
  const jsPath = path.join(packageRoot, 'dist', 'index.js');

  if (!fs.existsSync(cjsPath) || !fs.existsSync(jsPath)) {
    return;
  }

  const jsContent = fs.readFileSync(jsPath, 'utf8');
  if (!jsContent.includes('export{') && !jsContent.includes('export {')) {
    return;
  }

  const cjsContent = fs.readFileSync(cjsPath, 'utf8');
  fs.writeFileSync(jsPath, cjsContent, 'utf8');
  console.log('[postinstall] Patched baseline-browser-mapping/dist/index.js for legacy CommonJS loaders.');
}

try {
  patchBaselineBrowserMapping();
} catch (error) {
  console.warn('[postinstall] baseline-browser-mapping patch skipped:', error.message);
}
