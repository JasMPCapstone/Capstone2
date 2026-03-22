# MedSupply Portal — Secure Document Upload & Management

A secure web portal for **MedSupply Innovations** where clients and admins can upload, store, and manage business documents (PDF, DOCX, XLSX) with role-based access and full audit logging.

## Prerequisites

- **Node.js** 18 or later
- **MySQL** 8.0 (or 5.7)
- A terminal and browser to run and test the app

## 1. Clone / copy the project

Ensure all project files are present (e.g. `server.js`, `package.json`, `db/`, `routes/`, `views/`, etc.).

## 2. Environment variables

Copy the example env file and edit it:

```bash
copy .env.example .env
```

Edit `.env` and set at least:

- `DB_HOST` — usually `localhost`
- `DB_USER` — your MySQL username (e.g. `root`)
- `DB_PASSWORD` — your MySQL password
- `DB_NAME` — database name (e.g. `medsupply_portal`)
- `SESSION_SECRET` — a long random string for session signing (e.g. generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

Optional:

- `PORT` — server port (default `3000`)
- `MAX_UPLOAD_SIZE` — max file size in bytes (default 10485760 = 10MB)
- `ALLOWED_EXTENSIONS` — comma-separated (default `pdf,docx,xlsx`)

## 3. MySQL database setup

1. Create the database:

```sql
CREATE DATABASE medsupply_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Run schema and seed data (creates tables and test users):

```bash
npm install
npm run setup-db
```

This runs `db/schema.sql` and inserts two test accounts (see below). If you prefer to run SQL by hand:

- Execute `db/schema.sql` in the `medsupply_portal` database.
- Then run `npm run setup-db` once to seed users with correct password hashes, or insert users manually with bcrypt-hashed passwords.

## 4. Run the application

```bash
npm start
```

Then open: **http://localhost:3000**

## Test accounts (after `npm run setup-db`)

| Role   | Email                 | Password  |
|--------|------------------------|-----------|
| Admin  | admin@medsupply.com    | admin123  |
| Client | client@example.com    | client123 |

## Example usage

### As a client

1. Log in with `client@example.com` / `client123` (or register a new account).
2. Go to **Documents** → **Upload document**. Choose a PDF, DOCX, or XLSX file (max 10MB), optionally add title/description/tags, then upload.
3. On **Documents** you can search by filename/title, filter by type and date range, and open, download, edit metadata, or delete your documents.

### As an admin

1. Log in with `admin@medsupply.com` / `admin123`.
2. **Admin** dashboard shows counts for users, documents, and audit log entries.
3. **Users**: view all users; deactivate/reactivate accounts; reset a user’s password.
4. **Audit log**: view all logged actions; filter by action, user ID, and date range.
5. **Documents**: same list as client but includes all users’ documents and an “Owner” column.

## Project structure (overview)

- `server.js` — Express app, session, routes, error handler
- `config/database.js` — MySQL connection pool
- `db/schema.sql` — table definitions; `db/seed.sql` — seed notes
- `scripts/setup-db.js` — apply schema and seed users (run via `npm run setup-db`)
- `routes/auth.js` — login, register, logout
- `routes/documents.js` — document CRUD, upload, download, search/filter
- `routes/admin.js` — user management, password reset, audit log
- `middleware/auth.js` — require login / require admin
- `middleware/upload.js` — Multer config (allowed types, size limit)
- `lib/audit.js` — write to `audit_logs`
- `views/` — EJS templates (login, register, documents, admin)
- `public/css/style.css` — styles
- `uploads/` — stored files (created at runtime; in `.gitignore`)

## Database schema (summary)

- **users** — id, email, password_hash, full_name, role (CLIENT|ADMIN), is_active, timestamps
- **documents** — id, user_id, filename (on disk), original_filename, file_type, file_extension, file_size, title, description, tags, deleted_at, timestamps
- **audit_logs** — id, user_id, action, details, ip_address, created_at

## Security notes

- Passwords are hashed with bcrypt.
- Sessions are used for auth; protect `SESSION_SECRET` in production.
- Document access: clients see only their own; admins see all. Every document action checks ownership or admin.
- Uploads: only PDF, DOCX, XLSX; max size from `MAX_UPLOAD_SIZE`.
- Input is validated and errors returned with clear messages.

## Testing

- **Manual checklist**: see `tests/TEST-CHECKLIST.md`.
- **Automated**: run `npm test` for basic login and document-upload checks (requires server and DB configured; see checklist).

## License

MIT.
