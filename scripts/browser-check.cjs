const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const http = require('http');

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

  console.log('Starting Next.js frontend directly on port 4200...');
  // Directly call next dev on port 4200 in the apps/gavai/web workspace
  const web = spawn('npx', ['next', 'dev', '-p', '4200'], {
    cwd: 'apps/gavai/web',
    shell: true,
    stdio: 'inherit',
  });

  // Wait for servers to start
  console.log('Waiting for servers to become healthy...');
  for (let i = 0; i < 30; i++) {
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
    console.log(`Retrying healthcheck... (${i + 1}/30)`);
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

  console.log('Launching headless browser with system Edge...');
  // Use preinstalled Microsoft Edge on Windows to ensure executable is found
  const browser = await puppeteer.launch({
    headless: true,
    executablePath:
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log('Navigating to login page...');
    await page.goto('http://localhost:4200/auth/login', {
      waitUntil: 'networkidle2',
    });

    console.log('Logging in...');
    await page.type('input[type="email"]', 'admin@gavai.dev');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    console.log('Waiting for login redirect...');
    await wait(6000);

    console.log('Navigating to normalize review page...');
    await page.goto('http://localhost:4200/admin/normalize', {
      waitUntil: 'networkidle2',
    });
    await wait(4000);

    const screenshotPath =
      'C:\\Users\\grapz\\.gemini\\antigravity-ide\\brain\\e7eb8e8c-a5c9-42c0-bb9b-c4906558daae\\admin_normalize_page.png';
    console.log(`Taking screenshot: ${screenshotPath}`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log('Browser check complete!');
  } catch (err) {
    console.error('Error during browser execution:', err);
  } finally {
    await browser.close();
    if (servers && servers.web) {
      console.log('Stopping Next.js dev server...');
      servers.web.kill('SIGTERM');
    }
    process.exit(0);
  }
}

run();
