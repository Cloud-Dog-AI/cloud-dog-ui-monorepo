import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: ['tests/mcp-a2a-console.spec.ts','tests/smoke.spec.ts','tests/e2e/w28a-692-jobs-conformance.spec.ts'],
  workers: 1, retries: 0, timeout: 120000, expect: { timeout: 20000 },
  reporter: [['list'],['json',{outputFile:'/opt/iac/Development/cloud-dog-ai/cloud-dog-ai-platform-standards/working/evidence/W28A-774-sql-agent-mcp-a2a-webui-compliance/current/04-t3-regression/regression-results.json'}],['junit',{outputFile:'/opt/iac/Development/cloud-dog-ai/cloud-dog-ai-platform-standards/working/evidence/W28A-774-sql-agent-mcp-a2a-webui-compliance/current/04-t3-regression/regression-junit.xml'}]],
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8041', trace: 'retain-on-failure' },
  outputDir: '/opt/iac/Development/cloud-dog-ai/cloud-dog-ai-platform-standards/working/evidence/W28A-774-sql-agent-mcp-a2a-webui-compliance/current/04-t3-regression/test-results',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
