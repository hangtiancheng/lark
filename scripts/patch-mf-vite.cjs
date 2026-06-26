#!/usr/bin/env node
/**
 * Postinstall script to patch @module-federation/vite for workspace packages
 * with dual ESM/CJS exports.
 *
 * Problem: createRequire().resolve() returns .cjs paths for workspace packages,
 * which then get emitted in browser code causing "module is not defined" errors.
 *
 * Fix: Add resolveWorkspaceEsmEntry() helper that re-resolves workspace packages
 * to their ESM entry points.
 */

const fs = require('fs');
const path = require('path');

// Find ALL copies of @module-federation/vite in pnpm store
const PACKAGE_PATHS = [];

const pnpmStore = path.join(__dirname, '..', 'node_modules', '.pnpm');
if (fs.existsSync(pnpmStore)) {
  const dirs = fs.readdirSync(pnpmStore);
  for (const dir of dirs) {
    if (dir.startsWith('@module-federation+vite@')) {
      const candidate = path.join(pnpmStore, dir, 'node_modules', '@module-federation', 'vite', 'lib', 'index.js');
      if (fs.existsSync(candidate)) {
        PACKAGE_PATHS.push(candidate);
      }
    }
  }
}

if (PACKAGE_PATHS.length === 0) {
  console.log('[patch-mf-vite] Skipping: @module-federation/vite not found');
  process.exit(0);
}

console.log(`[patch-mf-vite] Found ${PACKAGE_PATHS.length} copies to patch`);

let patchedCount = 0;
for (const PACKAGE_PATH of PACKAGE_PATHS) {
  const content = fs.readFileSync(PACKAGE_PATH, 'utf8');

  // Check if already patched
  if (content.includes('resolveWorkspaceEsmEntry')) {
    console.log(`[patch-mf-vite] Already patched: ${path.basename(path.dirname(path.dirname(path.dirname(PACKAGE_PATH))))}`);
    patchedCount++;
    continue;
  }

  // Add the helper function after isWorkspaceFilePath
  const HELPER_CODE = `
function resolveWorkspaceEsmEntry(pkg, resolved) {
	if (!isWorkspaceFilePath(resolved)) return resolved;
	const esmEntry = getInstalledPackageEntry(pkg, {
		conditions: ["browser", "import", "module", "default"],
		resolveSubpathWithRequire: false
	});
	if (esmEntry && isWorkspaceFilePath(esmEntry)) return esmEntry;
	return resolved;
}
`;

  const MARKER = 'function isWorkspacePackageEntry(pkg, resolved)';
  const markerIndex = content.indexOf(MARKER);
  if (markerIndex === -1) {
    console.error(`[patch-mf-vite] Could not find insertion point in: ${PACKAGE_PATH}`);
    continue;
  }

  let newContent = content.slice(0, markerIndex) + HELPER_CODE + content.slice(markerIndex);

  // Patch getLocalProviderImportPath
  newContent = newContent.replace(
    /const resolved = createRequire\$1\(pathToFileURL\(path\$1\.join\(getPackageDetectionCwd\(\), "package\.json"\)\)\)\.resolve\(pkg\);/,
    'const resolved = resolveWorkspaceEsmEntry(pkg, createRequire$1(pathToFileURL(path$1.join(getPackageDetectionCwd(), "package.json"))).resolve(pkg));'
  );

  // Patch getProjectResolvedImportPath
  newContent = newContent.replace(
    /return createRequire\$1\(pathToFileURL\(path\$1\.join\(getPackageDetectionCwd\(\), "package\.json"\)\)\)\.resolve\(pkg\);/,
    'return resolveWorkspaceEsmEntry(pkg, createRequire$1(pathToFileURL(path$1.join(getPackageDetectionCwd(), "package.json"))).resolve(pkg));'
  );

  // Patch tryResolveImportFromPackageRoot
  newContent = newContent.replace(
    /return createRequire\$1\(pathToFileURL\(path\$1\.join\(root, "package\.json"\)\)\)\.resolve\(pkg\);/,
    'return resolveWorkspaceEsmEntry(pkg, createRequire$1(pathToFileURL(path$1.join(root, "package.json"))).resolve(pkg));'
  );

  fs.writeFileSync(PACKAGE_PATH, newContent, 'utf8');
  console.log(`[patch-mf-vite] Patched: ${path.basename(path.dirname(path.dirname(path.dirname(PACKAGE_PATH))))}`);
  patchedCount++;
}

console.log(`[patch-mf-vite] Successfully patched ${patchedCount}/${PACKAGE_PATHS.length} copies`);
