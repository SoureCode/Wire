import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));
const harnessFor = (env) => path.join(root, 'tests', 'harness', env);
const dbFor = (env) => path.join(harnessFor(env), 'var', 'data_e2e.db');

export default defineConfig({
    testDir: 'assets/tests/e2e',
    globalSetup: './assets/tests/e2e/global-setup.js',
    workers: 1,
    use: {
        baseURL: 'http://localhost:8123',
        launchOptions: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: [
        {
            command: `cd ${harnessFor('dev')} && APP_ENV=dev APP_SECRET=e2esecret DATABASE_URL="sqlite:///${dbFor('dev')}" symfony server:start --port=8123 --no-tls`,
            url: 'http://localhost:8123/wire-test/fixture',
            reuseExistingServer: !process.env.CI,
        },
        {
            command: `cd ${harnessFor('prod')} && APP_ENV=prod APP_DEBUG=0 APP_SECRET=e2esecret DATABASE_URL="sqlite:///${dbFor('prod')}" symfony server:start --port=8124 --no-tls`,
            url: 'http://localhost:8124/wire-test/fixture',
            reuseExistingServer: !process.env.CI,
        },
    ],
});
