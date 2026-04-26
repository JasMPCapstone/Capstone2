/**
 * Basic automated tests: login and document list/upload.
 * Run with: npm test
 * Requires: server running (npm start) and DB with seed users.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;

function request(method, url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url, BASE);
    const req = http.request(
      {
        method,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        headers: options.headers || {},
      },
      (res) => {
        let body = '';
        res.on('data', (ch) => (body += ch));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function getCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie || !setCookie.length) return null;
  return setCookie[0].split(';')[0];
}

async function main() {
  let passed = 0;
  let failed = 0;
  console.log('Tip: ensure server is running (npm start) and DB is set up (npm run setup-db).\n');

  // 0. API health (JSON)
  try {
    const r = await request('GET', '/api/health');
    if (r.status === 200 && r.body.includes('"ok":true')) {
      console.log('OK  GET /api/health returns JSON');
      passed++;
    } else {
      console.log('FAIL GET /api/health', r.status, r.body.slice(0, 80));
      failed++;
    }
  } catch (e) {
    if (e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET') {
      console.log('FAIL GET /api/health — cannot reach server. Start it first: npm start');
    } else {
      console.log('FAIL GET /api/health', e.message);
    }
    failed++;
  }

  // 1. Login page loads (SPA shell: built client must exist)
  try {
    const r = await request('GET', '/login');
    const spaShell =
      r.body.includes('id="root"') ||
      r.body.includes("id='root'") ||
      r.body.includes('Sign in') ||
      r.body.includes('Sign In');
    if (r.status === 200 && spaShell) {
      console.log('OK  GET /login returns 200 (SPA shell)');
      passed++;
    } else {
      console.log('FAIL GET /login', r.status, r.body.slice(0, 100));
      failed++;
    }
  } catch (e) {
    if (e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET') {
      console.log('FAIL GET /login — cannot reach server. Start it first: npm start');
    } else {
      console.log('FAIL GET /login', e.message);
    }
    failed++;
  }

  // 2. Login as system admin (staff accounts may be redirected through onboarding / 2FA)
  let cookie = null;
  try {
    const body = new URLSearchParams({ email: 'admin@medsupply.com', password: 'admin123' }).toString();
    const r = await request('POST', '/login', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
      body,
    });
    cookie = getCookie(r.headers);
    if (r.status === 302 && r.headers.location && r.headers.location === '/' && cookie) {
      console.log('OK  POST /login (system admin) redirects to / and sets session');
      passed++;
    } else {
      console.log('FAIL POST /login', r.status, r.headers.location, cookie ? 'cookie set' : 'no cookie');
      failed++;
    }
  } catch (e) {
    if (e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET') {
      console.log('FAIL POST /login — cannot reach server. Start it first: npm start');
    } else {
      console.log('FAIL POST /login', e.message);
    }
    failed++;
  }

  // 3. Document list when logged in
  if (cookie) {
    try {
      const r = await request('GET', '/documents', { headers: { Cookie: cookie } });
      if (
        r.status === 200 &&
        (r.body.includes('id="root"') ||
          r.body.includes("id='root'") ||
          r.body.includes('Documents') ||
          r.body.includes('document'))
      ) {
        console.log('OK  GET /documents (authenticated) returns 200');
        passed++;
      } else {
        console.log('FAIL GET /documents', r.status);
        failed++;
      }
    } catch (e) {
      console.log('FAIL GET /documents', e.message);
      failed++;
    }
  }

  // 4. Upload (minimal: small PDF-like file)
  if (cookie) {
    try {
      const boundary = '----TestBoundary' + Date.now();
      const filename = 'test.pdf';
      const fileContent = '%PDF-1.4 minimal';
      const payload =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="document"; filename="${filename}"\r\n` +
        `Content-Type: application/pdf\r\n\r\n` +
        fileContent +
        `\r\n--${boundary}\r\n` +
        `Content-Disposition: form-data; name="title"\r\n\r\n` +
        `Test Doc\r\n--${boundary}--\r\n`;
      const r = await request('POST', '/documents/upload', {
        headers: {
          Cookie: cookie,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(payload),
        },
        body: payload,
      });
      if (r.status === 302 && r.headers.location === '/documents') {
        console.log('OK  POST /documents/upload redirects to /documents');
        passed++;
      } else if (r.status === 200 && r.body.includes('Documents')) {
        console.log('OK  POST /documents/upload returns 200 (list page)');
        passed++;
      } else {
        console.log('FAIL POST /documents/upload', r.status, r.headers.location || '', r.body.slice(0, 150));
        failed++;
      }
    } catch (e) {
      console.log('FAIL POST /documents/upload', e.message);
      failed++;
    }
  }

  console.log('\n---');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
