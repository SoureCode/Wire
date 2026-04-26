import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const bootstrap = path.join(root, 'scripts', 'bootstrap-harness.sh');

export default function globalSetup() {
    for (const env of ['dev', 'prod']) {
        execSync(`bash ${bootstrap} ${env}`, { cwd: root, stdio: 'inherit' });
    }
}
