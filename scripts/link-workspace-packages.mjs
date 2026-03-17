import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const scopeDir = path.join(repoRoot, 'node_modules', '@aria');
fs.mkdirSync(scopeDir, { recursive: true });

const packageMap = {
  domain: path.join(repoRoot, 'packages', 'domain'),
  application: path.join(repoRoot, 'packages', 'application'),
  infrastructure: path.join(repoRoot, 'packages', 'infrastructure'),
};

for (const [name, target] of Object.entries(packageMap)) {
  const linkPath = path.join(scopeDir, name);
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      fs.rmSync(linkPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(linkPath);
    }
  } catch {
    // Link does not exist yet.
  }

  fs.symlinkSync(target, linkPath, 'junction');
}

console.log('Linked workspace packages under node_modules/@aria');
