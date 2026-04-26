# Deploy MedSupply Portal to Render — Step-by-Step

Follow these steps to put your app online so others can use it. Your local project and database stay on your computer unchanged.

---

## Prerequisites

- A **GitHub** account
- A **Render** account (free at [render.com](https://render.com))
- A **Railway** account (free at [railway.app](https://railway.app)) — for MySQL hosting

---

## Part 1: Push Your Code to GitHub

1. **Install Git** (if needed): [git-scm.com/downloads](https://git-scm.com/downloads)

2. **Open a terminal** in your project folder (`c:\Users\marlo\medsupply-portal`).

3. **Initialize Git and push** (if not already a Git repo):

   ```bash
   git init
   git add .
   git commit -m "Initial commit - ready for deployment"
   ```

4. **Create a new repository on GitHub:**
   - Go to [github.com/new](https://github.com/new)
   - Name it `medsupply-portal` (or any name)
   - Do **not** add a README or .gitignore
   - Click **Create repository**

5. **Connect and push** (replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub repo):

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

---

## Part 2: Create a MySQL Database on Railway

1. **Go to** [railway.app](https://railway.app) and sign up (or log in with GitHub).

2. **Create a new project:**
   - Click **"New Project"**
   - Choose **"Deploy from GitHub repo"** — you can skip this; instead click **"Empty Project"** or **"Add a service"**

3. **Add MySQL:**
   - Click **"+ New"** or **"Add Service"**
   - Select **"Database"**
   - Choose **MySQL**
   - Railway will provision a MySQL database (takes ~1 minute)

4. **Get the connection details:**
   - Click your MySQL service
   - Open the **"Variables"** or **"Connect"** tab
   - You’ll see: `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`
   - Copy these values for Render
   - If connecting from outside Railway, you may need to enable **"Public Networking"** or **"Expose"** so the database is reachable from the internet

---

## Part 3: Initialize the Database

You need to create the tables and seed users in Railway’s MySQL. Use one of these methods:

**Option A — From your terminal (recommended)**

1. Set environment variables (Windows CMD) with your Railway MySQL values:
   ```bash
   set DB_HOST=containers-us-west-xxx.railway.app
   set DB_PORT=12345
   set DB_USER=root
   set DB_PASSWORD=your_railway_password
   set DB_NAME=railway
   set DB_SSL=false
   ```
2. Run: `npm run setup-db`
3. Run the 2FA migration. Open MySQL (or use `mysql` CLI) with the same credentials and run:
   ```sql
   ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255) DEFAULT NULL;
   ALTER TABLE users ADD COLUMN two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0;
   ```

**Option B — Using a MySQL client (e.g. MySQL Workbench, DBeaver)**

1. Connect with Railway’s host, port, user, password, and database.
2. Run `db/schema.sql`, then `db/migrate-two-factor.sql`.
3. Run the seed INSERTs from `scripts/setup-db.js` (or run `npm run setup-db` locally with DB_* env vars pointing to Railway).

---

## Part 4: Deploy to Render

1. **Go to** [render.com](https://render.com) and sign up (or log in with GitHub).

2. **Create a Web Service:**
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub account if prompted
   - Select your `medsupply-portal` repository
   - Click **"Connect"**

3. **Configure the service:**

   | Field | Value |
   |-------|-------|
   | **Name** | `medsupply-portal` (or any name) |
   | **Region** | Oregon (US West) or closest to you |
   | **Branch** | `main` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Instance Type** | Free |

4. **Add environment variables:**
   - Scroll to **"Environment Variables"**
   - Click **"Add Environment Variable"** and add each:

   | Key | Value |
   |----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` |
   | `SESSION_SECRET` | (generate one: run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
   | `DB_HOST` | (from Railway `MYSQLHOST`) |
   | `DB_PORT` | (from Railway `MYSQLPORT`) |
   | `DB_USER` | (from Railway `MYSQLUSER`) |
   | `DB_PASSWORD` | (from Railway `MYSQLPASSWORD`) |
   | `DB_NAME` | (from Railway `MYSQLDATABASE`) |
   | `MAX_UPLOAD_SIZE` | `10485760` |
   | `ALLOWED_EXTENSIONS` | `pdf,docx,xlsx,doc,xls,png,jpg,jpeg` |
   | `DB_SSL` | `false` (needed for Railway MySQL from Render) |
   | `STORAGE_DRIVER` | `s3` (to store uploads in Amazon S3 instead of Render disk) |
   | `S3_REGION` | `ap-southeast-2` (or your bucket region) |
   | `S3_BUCKET` | Your bucket name, e.g. `medsupplyproject-584612873265-ap-southeast-2-an` |
   | `S3_ACCESS_KEY_ID` | From an IAM user with S3 access to that bucket |
   | `S3_SECRET_ACCESS_KEY` | Same IAM user’s secret (mark as **Secret** in Render) |

5. **Deploy:**
   - Click **"Create Web Service"**
   - Render will build and deploy (about 2–3 minutes)
   - Your app will be at `https://medsupply-portal.onrender.com` (or similar)

---

## Part 5: Verify It Works

1. Open the URL Render gives you (e.g. `https://medsupply-portal-xxxx.onrender.com`).

2. You should see the login page.

3. Log in with:
   - **Admin:** `admin@medsupply.com` / `admin123`
   - **Client:** `client@example.com` / `client123`

4. Try uploading a document and using the app.

---

## Important Notes

### Uploaded files

Render’s free tier uses **ephemeral disk**. Files in the `uploads/` folder are lost when Render restarts or redeploys. The app works, but document files do not persist long term.

**To make uploads persist**, you’d later add cloud storage (e.g. AWS S3) and change the app to save files there.

### Free tier limits

- **Render:** Free services spin down after 15 minutes of inactivity. First request after that can take 30–60 seconds.
- **Railway:** $5 free credit per month; MySQL uses part of that.

### Your local setup

Your project and local MySQL stay the same. Deployments use the Railway database, not your local one.

---

## Updating the App Later

1. Edit your code locally.
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your update message"
   git push
   ```
3. Render will automatically rebuild and redeploy.

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| Build fails | Check the build log; ensure all deps are in `package.json` and `npm install` runs without errors. |
| 503 / Service Unavailable | Wait 1–2 minutes; free services can take time to start. |
| Login fails / DB errors | Confirm env vars in Render match the Railway DB. Add `DB_SSL=false` if connecting to Railway MySQL externally. |
| Upload fails | Ensure `uploads/` folder can be created; on Render this is ephemeral. |
