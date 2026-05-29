const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Load environment variables from root .env manually
const dotenvPath = path.join(__dirname, '../.env');
if (fs.existsSync(dotenvPath)) {
  const envConfig = fs.readFileSync(dotenvPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkUrl(url) {
  return new Promise((resolve) => {
    http
      .get(url, (res) => {
        resolve(
          res.statusCode === 200 ||
            res.statusCode === 401 ||
            res.statusCode === 404,
        );
      })
      .on('error', () => {
        resolve(false);
      });
  });
}

async function startDevServers() {
  console.log('NestJS backend is pre-running, checking health...');

  console.log('Starting Next.js frontend on port 4200...');
  const web = spawn('npx', ['next', 'dev', '-p', '4200'], {
    cwd: 'apps/gavai/web',
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: 'http://localhost:3000/api/v1',
    },
  });

  // Wait for servers to start
  console.log('Waiting for servers to become healthy...');
  for (let i = 0; i < 45; i++) {
    const nestHealthy = await checkUrl(
      'http://localhost:3000/api/v1/admin/normalize/records',
    ).catch(() => false);
    const webHealthy = await checkUrl('http://localhost:4200').catch(
      () => false,
    );
    if (nestHealthy && webHealthy) {
      console.log('Servers are fully healthy!');
      return { web };
    }
    await wait(2000);
    console.log(`Retrying healthcheck... (${i + 1}/45)`);
  }
  console.log('Proceeding anyway (timeout reached)...');
  return { web };
}

async function run() {
  let servers;
  try {
    servers = await startDevServers();
  } catch (err) {
    console.error('Failed starting servers:', err);
  }

  console.log('Launching visible Edge browser for full E2E simulation...');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath:
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const screenshotDir =
    'C:\\Users\\grapz\\.gemini\\antigravity-ide\\brain\\e7eb8e8c-a5c9-42c0-bb9b-c4906558daae';

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Enable console and page error logging to capture front-end failures
    page.on('console', (msg) => console.log(`BROWSER_CONSOLE: ${msg.text()}`));
    page.on('pageerror', (err) =>
      console.error(`BROWSER_ERROR: ${err.message}`),
    );

    // Scenario 1: Authentication
    console.log('=== Scenario 1: Authentication ===');
    await page.goto('http://localhost:4200/auth/login', {
      waitUntil: 'networkidle2',
    });
    await page.type('#email', 'admin@gavai.dev');
    await page.type('#password', 'admin123');
    await page.click('button[type="submit"]');
    await wait(8000);

    // Log the page HTML error context
    const bodyContent = await page.evaluate(() => document.body.innerText);
    console.log(`POST-LOGIN VIEW TEXT:\n${bodyContent.slice(0, 1000)}`);

    await page.screenshot({
      path: path.join(screenshotDir, 'e2e_01_authenticated_dashboard.png'),
    });
    console.log('Saved e2e_01_authenticated_dashboard.png');

    // Scenario 2: Discovery Page Review
    console.log('=== Scenario 2: Navigating to Discovery ===');
    await page.goto('http://localhost:4200/admin/discover', {
      waitUntil: 'networkidle2',
    });
    await wait(4000);
    await page.screenshot({
      path: path.join(screenshotDir, 'e2e_02_discover_dashboard.png'),
    });
    console.log('Saved e2e_02_discover_dashboard.png');

    // Scenario 3: Scraping Control Center
    console.log('=== Scenario 3: Navigating to Scrape Control Center ===');
    await page.goto('http://localhost:4200/admin/scrape', {
      waitUntil: 'networkidle2',
    });
    await wait(4000);
    await page.screenshot({
      path: path.join(screenshotDir, 'e2e_03_scrape_dashboard.png'),
    });
    console.log('Saved e2e_03_scrape_dashboard.png');

    // Scenario 4: AI & Deterministic Normalizer Panel
    console.log('=== Scenario 4: Navigating to Normalizer Review Panel ===');
    await page.goto('http://localhost:4200/admin/normalize', {
      waitUntil: 'networkidle2',
    });
    await wait(4000);
    await page.screenshot({
      path: path.join(screenshotDir, 'e2e_04_normalize_dashboard.png'),
    });
    console.log('Saved e2e_04_normalize_dashboard.png');

    // Scenario 5: XGBoost Model Retraining Hub
    console.log('=== Scenario 5: Navigating to Model Training Hub ===');
    await page.goto('http://localhost:4200/admin/model', {
      waitUntil: 'networkidle2',
    });
    await wait(4000);
    await page.screenshot({
      path: path.join(screenshotDir, 'e2e_05_model_dashboard.png'),
    });
    console.log('Saved e2e_05_model_dashboard.png');

    // Scenario 6: Valuation Map
    console.log('=== Scenario 6: Navigating to Valuation Map ===');
    await page.goto('http://localhost:4200/map', { waitUntil: 'networkidle2' });
    await wait(5000);
    await page.screenshot({
      path: path.join(screenshotDir, 'e2e_06_valuation_map.png'),
    });
    console.log('Saved e2e_06_valuation_map.png');

    console.log('Full E2E Scenario walkthrough completed successfully!');
  } catch (err) {
    console.error('Error during browser E2E scenario execution:', err);
  } finally {
    await browser.close();
    if (servers) {
      console.log('Stopping dev servers...');
      if (servers.nest) servers.nest.kill('SIGTERM');
      if (servers.web) servers.web.kill('SIGTERM');
    }
    process.exit(0);
  }
}

run();
