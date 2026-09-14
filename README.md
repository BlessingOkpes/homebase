# HomeBase — Deployment Guide

## Project Structure
```
homebase-deploy/
├── frontend/           ← All HTML pages
│   ├── index.html          Landing + Login + Search
│   ├── HomeBase_Tenant.html
│   ├── HomeBase_Landlord.html
│   └── HomeBase_Admin.html
└── backend/            ← Node.js API
    ├── server.js
    ├── package.json
    ├── .env.example
    ├── config/db.js
    ├── middleware/auth.js
    └── routes/
```

---

## STEP 1 — Set Up Your Database (FreeSQLDatabase.net — Free)

1. Go to https://www.freesqldatabase.com
2. Sign up for a free account
3. Create a new MySQL database
4. Note down: Host, Username, Password, Database name
5. Open your MySQL client (phpMyAdmin or TablePlus)
6. Import the file: homebase_schema_v2.sql

---

## STEP 2 — Push to GitHub

1. Create a free account at https://github.com
2. Create a new repository called **homebase**
3. Upload ALL files from this folder to the repository
4. Make sure both frontend/ and backend/ folders are included

---

## STEP 3 — Deploy Backend on Render

1. Go to https://render.com and sign up free
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Fill in these settings:
   - **Name:** homebase-api
   - **Root Directory:** backend
   - **Build Command:** npm install
   - **Start Command:** npm start
   - **Environment:** Node
5. Under **Environment Variables**, add:
   - DB_HOST = (your FreeSQLDatabase host)
   - DB_PORT = 3306
   - DB_USER = (your username)
   - DB_PASSWORD = (your password)
   - DB_NAME = homebase_db
   - JWT_SECRET = (any long random string)
6. Click **Create Web Service**
7. Wait for deployment — Render gives you a URL like:
   https://homebase-api.onrender.com

---

## STEP 4 — Your App is Live!

Once deployed, your app URLs will be:
- Landing Page:       https://homebase-api.onrender.com
- Tenant Dashboard:  https://homebase-api.onrender.com/HomeBase_Tenant.html
- Landlord Dashboard: https://homebase-api.onrender.com/HomeBase_Landlord.html
- Admin Panel:        https://homebase-api.onrender.com/HomeBase_Admin.html
- API Health Check:   https://homebase-api.onrender.com/api/health

---

## Notes
- Render free tier spins down after 15 minutes of inactivity
- First load after inactivity may take 30-60 seconds
- For always-on hosting, upgrade to Render Starter ($7/month)
- Database: FreeSQLDatabase gives 5MB free — enough for testing
