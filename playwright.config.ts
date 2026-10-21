import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'**/*.spec.ts',fullyParallel:true,workers:2,
 use:{baseURL:'http://127.0.0.1:4173/dephasage-lab/',reducedMotion:'reduce',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}},
 webServer:{command:process.env.TEST_PRODUCTION?'npm run preview -- --port 4173 --base /dephasage-lab/':'npm run dev -- --port 4173 --base /dephasage-lab/',url:'http://127.0.0.1:4173/dephasage-lab/',reuseExistingServer:!process.env.CI},
 reporter:'list'
});
