#!/usr/bin/env node
/**
 * One-time repo cleanup: renames every PascalCase file under src/ to
 * camelCase (lowercase the first letter only), using a two-step `git mv`
 * so the case change actually registers with git on a case-insensitive
 * filesystem (Windows/OneDrive silently no-ops a direct PascalCase ->
 * camelCase rename otherwise -- that's the same bug that broke the
 * Vercel build for useAuth.js).
 *
 * Then rewrites every relative import/require path (and CSS-style side
 * effect imports) in src/ that pointed at an old filename, so nothing is
 * left referencing a name that no longer exists.
 *
 * Usage (from the project root, i.e. the folder containing package.json):
 *   node rename-to-camelcase.js
 *
 * Run this on a clean git status (commit or stash first) so you can
 * review the diff afterwards and undo easily with `git reset --hard`
 * if anything looks wrong.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(process.cwd(), 'src');
const RENAMEABLE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.css'];

if (!fs.existsSync(SRC_DIR)) {
  console.error('Could not find a "src" folder in the current directory. Run this from your project root.');
  process.exit(1);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function camelCase(basename) {
  // Lowercase the first letter only -- "RecipeLibrary" -> "recipeLibrary".
  return basename.charAt(0).toLowerCase() + basename.slice(1);
}

function splitNameAndCompoundExt(filename) {
  // Handles "Login.test.js" -> { base: "Login", rest: ".test.js" } as well
  // as the simple "Login.js" -> { base: "Login", rest: ".js" } case.
  const parts = filename.split('.');
  return { base: parts[0], rest: '.' + parts.slice(1).join('.') };
}

const allFiles = walk(SRC_DIR);

// --- Step 1: work out what needs renaming ------------------------------
const renames = []; // { oldPath, newPath, oldBase, newBase, ext }
const jsBaseRenameMap = new Map(); // "Login" -> "login"
const cssBaseRenameMap = new Map(); // "App.css" -> "app.css"

for (const filePath of allFiles) {
  const ext = path.extname(filePath);
  if (!RENAMEABLE_EXTENSIONS.includes(ext)) continue;

  const filename = path.basename(filePath);
  const { base } = splitNameAndCompoundExt(filename);

  if (!/^[A-Z]/.test(base)) continue; // already camelCase/lowercase, skip

  const newBase = camelCase(base);
  const newFilename = newBase + filename.slice(base.length);
  const newPath = path.join(path.dirname(filePath), newFilename);

  renames.push({ oldPath: filePath, newPath, oldBase: base, newBase, ext });

  if (ext === '.css') {
    cssBaseRenameMap.set(filename, newFilename);
  } else {
    jsBaseRenameMap.set(base, newBase);
  }
}

if (renames.length === 0) {
  console.log('Nothing to rename -- every file already starts with a lowercase letter.');
  process.exit(0);
}

console.log(`Renaming ${renames.length} file(s):`);
for (const r of renames) {
  console.log(`  ${path.relative(process.cwd(), r.oldPath)} -> ${path.basename(r.newPath)}`);
}

// --- Step 2: two-step git mv for each file ------------------------------
for (const { oldPath, newPath } of renames) {
  const rel = path.relative(process.cwd(), oldPath);
  const tempRel = rel + '__camelcase_tmp';
  const newRel = path.relative(process.cwd(), newPath);
  execSync(`git mv "${rel}" "${tempRel}"`, { stdio: 'inherit' });
  execSync(`git mv "${tempRel}" "${newRel}"`, { stdio: 'inherit' });
}

// --- Step 3: rewrite import/require paths in every remaining JS file ----
// Matches `from '...'`, `require('...')`, and bare side-effect imports
// like `import './App.css';` (no `from` keyword at all).
const IMPORT_PATH_RE = /(from\s+|require\(|import\s+)(['"])([^'"]+)\2/g;

function rewriteImports(content) {
  return content.replace(IMPORT_PATH_RE, (match, prefix, quote, importPath) => {
    // Only touch relative imports -- leave npm packages (react, react-router-dom, etc.) alone.
    if (!importPath.startsWith('.')) return match;

    const segments = importPath.split('/');
    const last = segments[segments.length - 1];

    // CSS-style import: the extension is part of the string ("./App.css").
    if (cssBaseRenameMap.has(last)) {
      segments[segments.length - 1] = cssBaseRenameMap.get(last);
      return `${prefix}${quote}${segments.join('/')}${quote}`;
    }

    // JS-style import: extension is omitted in the string ("./Login").
    if (jsBaseRenameMap.has(last)) {
      segments[segments.length - 1] = jsBaseRenameMap.get(last);
      return `${prefix}${quote}${segments.join('/')}${quote}`;
    }

    return match;
  });
}

// Re-walk, since paths on disk have changed.
const filesAfterRename = walk(SRC_DIR).filter((f) => ['.js', '.jsx', '.ts', '.tsx'].includes(path.extname(f)));

let filesChanged = 0;
for (const filePath of filesAfterRename) {
  const original = fs.readFileSync(filePath, 'utf8');
  const updated = rewriteImports(original);
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    filesChanged++;
    console.log(`  updated imports in ${path.relative(process.cwd(), filePath)}`);
  }
}

console.log(`\nDone. ${renames.length} file(s) renamed, ${filesChanged} file(s) had import paths updated.`);
console.log('Next: review `git status` / `git diff --cached`, then run `npm test` and `npm start` before committing.');