import { execSync } from 'child_process';
import { copyFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export default function globalSetup() {
    execSync('npm run build', { cwd: root, stdio: 'inherit' });

    copyFileSync(
        path.join(root, 'dist', 'wire.iife.js'),
        path.join(root, 'tests', 'harness', 'public', 'wire.js'),
    );
}
