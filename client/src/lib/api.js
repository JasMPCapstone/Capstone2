/**
 * Session API helpers.
 *
 * Login uses a real HTML form POST (see LoginPage) so the browser applies Set-Cookie
 * on redirects. JSON APIs use redirect: 'follow' and parse the final URL / content-type.
 */

const BACKEND_UNREACHABLE =
  'Cannot reach the API. Start the Express app on port 3000 (e.g. run `npm run dev` in the project root), or use `npm run dev:full` to run the API and Vite together.';

function parseUrl(href) {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}

/** Server routes users must complete before JSON API is available (matches server onboarding). */
function mustLeaveSpaForOnboarding(url) {
  if (url.pathname.startsWith('/account/change-password')) return true;
  if (url.pathname.startsWith('/settings/2fa')) return true;
  if (url.pathname === '/profile') return true;
  if (url.pathname === '/' && url.searchParams.get('onboarding') === 'profile') return true;
  if (url.pathname === '/dashboard' && url.searchParams.get('onboarding') === 'profile') return true;
  return false;
}

function isLoginPageUrl(url) {
  const p = url.pathname;
  return p === '/login' || (p.startsWith('/login') && !p.startsWith('/login/2fa'));
}

/**
 * True if the current page already satisfies the onboarding redirect target.
 * Pathname must match; every query param on the redirect must match the current URL.
 * Extra query params on the current URL are allowed (e.g. /profile?saved=1 vs redirect /profile).
 */
function isAlreadyAtRedirectTarget(redirectPathOrUrl) {
  try {
    const dest = new URL(redirectPathOrUrl, window.location.href);
    const here = new URL(window.location.href);
    const normPath = (p) => {
      if (!p || p === '/') return '/';
      return p.length > 1 && p.endsWith('/') ? p.replace(/\/+$/, '') : p;
    };
    if (normPath(dest.pathname) !== normPath(here.pathname)) return false;
    for (const key of dest.searchParams.keys()) {
      if (here.searchParams.get(key) !== dest.searchParams.get(key)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * @returns {'ok'|'redirect'|'unauthorized'|'error'}
 */
export async function fetchApiJson(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      credentials: 'include',
      redirect: 'follow',
      ...options,
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
    });
  } catch {
    return { kind: 'error', error: BACKEND_UNREACHABLE };
  }

  if (res.status === 0 || res.type === 'opaque') {
    return { kind: 'error', error: BACKEND_UNREACHABLE };
  }

  if ([502, 503, 504].includes(res.status)) {
    return { kind: 'error', error: BACKEND_UNREACHABLE };
  }

  const finalUrl = parseUrl(res.url);
  if (!finalUrl) {
    return { kind: 'error', error: 'Invalid response URL.' };
  }

  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const isJson = ct.includes('application/json');

  if (isJson) {
    try {
      const data = await res.json();
      if (res.ok) {
        return { kind: 'ok', data };
      }
      if (res.status === 401) {
        return { kind: 'unauthorized' };
      }
      if (res.status === 403 && data && data.code === 'ONBOARDING' && typeof data.redirect === 'string') {
        const already = isAlreadyAtRedirectTarget(data.redirect);
        if (!already) {
          window.location.assign(new URL(data.redirect, window.location.href).href);
          return { kind: 'redirect' };
        }
        const msg = typeof data.error === 'string' ? data.error : 'Complete the current step to continue.';
        return { kind: 'error', error: msg };
      }
      const msg = data && typeof data.error === 'string' ? data.error : `Request failed (${res.status})`;
      return { kind: 'error', error: msg };
    } catch {
      return { kind: 'error', error: `Request failed (${res.status})` };
    }
  }

  if (!isJson && res.status === 401) {
    return { kind: 'unauthorized' };
  }

  // HTML or other: often a redirect to login or onboarding
  if (isLoginPageUrl(finalUrl)) {
    return { kind: 'unauthorized' };
  }

  if (mustLeaveSpaForOnboarding(finalUrl)) {
    if (isAlreadyAtRedirectTarget(finalUrl.href)) {
      return { kind: 'error', error: 'Complete the current step to continue.' };
    }
    window.location.assign(finalUrl.href);
    return { kind: 'redirect' };
  }

  if (!res.ok) {
    return { kind: 'error', error: `Request failed (${res.status})` };
  }

  return { kind: 'error', error: 'Unexpected response from server.' };
}

export async function fetchMe() {
  return fetchApiJson('/api/me');
}

/** Extended profile for header menu (email, address, organization). */
export async function fetchProfileSnapshot() {
  const t = Date.now();
  return fetchApiJson(`/api/profile?_=${t}`, { cache: 'no-store' });
}

/** JPEG, PNG, or WebP; size limit set on server (default 8MB, env AVATAR_MAX_BYTES). */
export async function postProfileAvatar(file) {
  if (!file) return { kind: 'error', error: 'No file chosen.' };
  const body = new FormData();
  body.append('avatar', file);
  return fetchApiJson('/api/profile/avatar', { method: 'POST', body });
}

export async function deleteProfileAvatar() {
  return fetchApiJson('/api/profile/avatar', { method: 'DELETE' });
}

export async function fetchDocuments(search = '') {
  const q = search && !search.startsWith('?') ? `?${search}` : search;
  return fetchApiJson(`/api/documents${q}`);
}

export async function fetchNotifications() {
  return fetchApiJson('/api/notifications');
}

export async function postNotificationsMarkRead() {
  return fetchApiJson('/api/notifications/mark-read', { method: 'POST' });
}

/** Mark one document as seen in the notification bell (persists per user). */
export async function postNotificationsMarkDocumentRead(documentId) {
  const n = Number(documentId);
  if (!Number.isFinite(n) || n <= 0) {
    return { kind: 'error', error: 'Invalid document id' };
  }
  return fetchApiJson('/api/notifications/mark-document-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: n }),
  });
}

/** POST /api/forgot-password — JSON; same privacy rules as HTML forgot flow. */
export async function postForgotPassword(email) {
  return fetchApiJson('/api/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: (email || '').trim() }),
  });
}

export async function postLogout() {
  let res;
  try {
    res = await fetch('/logout', {
      method: 'POST',
      credentials: 'include',
      redirect: 'follow',
    });
  } catch {
    return { kind: 'error', error: BACKEND_UNREACHABLE };
  }

  if ([502, 503, 504].includes(res.status)) {
    return { kind: 'error', error: BACKEND_UNREACHABLE };
  }

  window.location.assign(`${window.location.origin}/login`);
  return { kind: 'redirect' };
}

export async function fetchDocument(id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return { kind: 'error', error: 'Invalid document id' };
  }
  return fetchApiJson(`/api/documents/${n}`);
}

/** Audit-based activity for one document (upload, edits, approval, download). */
export async function fetchDocumentHistory(id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return { kind: 'error', error: 'Invalid document id' };
  }
  return fetchApiJson(`/api/documents/${n}/history`);
}

/** @param {'required'|''} [styleSuffix] Pass `'required'` when URL has `?style=required` (onboarding). */
export async function fetchTwoFactorSettings(styleSuffix) {
  const q = styleSuffix === 'required' ? '?style=required' : '';
  return fetchApiJson(`/api/settings/2fa${q}`);
}

/** @param {'required'|''} [styleSuffix] */
export async function postTwoFactorStart(styleSuffix) {
  const q = styleSuffix === 'required' ? '?style=required' : '';
  return fetchApiJson(`/api/settings/2fa/start${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

export async function postTwoFactorCancel() {
  return fetchApiJson('/api/settings/2fa/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

/** @param {string} path Path under `/api/admin`, e.g. `/dashboard` or `/users?page=1` */
export async function fetchAdmin(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return fetchApiJson(`/api/admin${p}`);
}

/** @param {string} path Path under `/api/company`, e.g. `/team` */
export async function fetchCompany(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return fetchApiJson(`/api/company${p}`);
}

