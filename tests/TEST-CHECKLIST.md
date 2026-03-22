# MedSupply Portal — Test Checklist

Use this checklist to verify core behaviour. Ensure the app is running (`npm start`) and the database is set up with seed users.

---

## Authentication

- [ ] **Register** — Open /register, submit valid email, full name, password (≥6 chars). Redirects to /login with success message.
- [ ] **Register duplicate email** — Register again with same email. Error: “An account with this email already exists.”
- [ ] **Login (client)** — Log in as client@example.com / client123. Redirects to /documents.
- [ ] **Login (admin)** — Log in as admin@medsupply.com / admin123. Redirects to /admin.
- [ ] **Login failure** — Wrong password or unknown email. Error message, no redirect.
- [ ] **Logout** — Click Logout. Session cleared, redirect to /login.

---

## Document management (as CLIENT)

- [ ] **List documents** — As client, /documents shows only that client’s documents (initially empty).
- [ ] **Upload** — Upload a PDF or DOCX (within size limit). File appears in list with correct name/type/size/date.
- [ ] **View detail** — Open a document. Details show filename, type, size, upload date, description/tags if set.
- [ ] **Download** — Download link returns the file with correct filename.
- [ ] **Edit metadata** — Change title/description/tags, save. Detail view shows updated data.
- [ ] **Delete** — Delete a document. It disappears from list; file removed from server.
- [ ] **Search** — Upload 2+ documents, use search by filename/title. Only matching documents shown.
- [ ] **Filter** — Filter by type (e.g. PDF) and/or date range. List updates correctly.

---

## Authorization (client vs admin)

- [ ] **Client cannot see other’s documents** — With two client accounts, upload as one; log in as the other. Other’s documents do not appear in list; direct URL /documents/:id returns 403 or 404 as designed.
- [ ] **Admin sees all documents** — As admin, /documents shows every user’s documents with an “Owner” column.
- [ ] **Admin can open/download any document** — Admin can view and download any document by ID.
- [ ] **Non-admin cannot access /admin** — Log in as client, open /admin. Should get 403 or redirect (no access).

---

## Admin

- [ ] **Users list** — /admin/users lists all users with role, status, created date.
- [ ] **Deactivate user** — Deactivate another user. Status shows “Deactivated”; that user cannot log in.
- [ ] **Reactivate user** — Reactivate same user. They can log in again.
- [ ] **Reset password** — As admin, reset a client’s password. Client can log in with new password.
- [ ] **Audit log** — /admin/audit shows entries for login, logout, upload, download, edit, delete, admin actions.
- [ ] **Audit filters** — Filter by action (e.g. LOGIN_SUCCESS), user ID, date range. Results update.

---

## Validation & errors

- [ ] **Upload invalid type** — Try uploading .txt or .exe. Rejected with clear message (allowed: PDF, DOCX, XLSX).
- [ ] **Upload oversized file** — File over MAX_UPLOAD_SIZE (e.g. 10MB). Rejected with size message.
- [ ] **Short password** — Register with password &lt; 6 characters. Validation error.

---

## Automated tests

Run:

```bash
npm test
```

This runs `tests/run-tests.js`, which performs HTTP requests to verify:

- Login with valid credentials returns 302 and redirect.
- Document list (when logged in) returns 200.
- Upload (multipart) with a small allowed file returns 302 (redirect to list) or 200.

Prerequisites: server running on configured PORT, database with seed users. See `tests/run-tests.js` for the exact base URL and behaviour.
