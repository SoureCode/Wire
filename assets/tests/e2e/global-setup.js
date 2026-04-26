import { execSync } from 'child_process';
import { copyFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const harnessFor = (env) => path.join(root, 'tests', 'harness', env);

export default function globalSetup() {
    execSync('npm run build', { cwd: root, stdio: 'inherit' });

    for (const env of ['dev', 'prod']) {
        copyFileSync(
            path.join(root, 'dist', 'wire.iife.js'),
            path.join(harnessFor(env), 'public', 'wire.js'),
        );
    }
}
