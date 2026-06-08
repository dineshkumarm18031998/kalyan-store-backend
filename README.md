# Kalyan Store — Complete App

## ✅ FRONTEND (Expo Go SDK 54)

### Step 1 — Open terminal in `frontend` folder
### Step 2 — Install
```
npm install --legacy-peer-deps
```
### Step 3 — Start
```
npx expo start --clear
```
### Step 4 — Scan QR with Expo Go on phone (must be SDK 54 / latest from Play Store)

---

## ✅ BACKEND (Node.js + PostgreSQL)

### Step 1 — Create `.env` in `backend` folder:
```
DATABASE_URL="postgresql://YOUR_DB_URL"
JWT_SECRET="any-secret-string-here"
PORT=3000
```

### Step 2 — Run:
```
cd backend
npm install
npx prisma db push
npm run dev
```

### Step 3 — Update API URL in `frontend/src/utils/api.js`:
```js
// For local testing (find your IP with: ipconfig)
const API_URL = 'http://192.168.1.X:3000/api';

// For production (after Railway deploy)
const API_URL = 'https://your-app.up.railway.app/api';
```

---

## ✅ Deploy Backend FREE on Railway

1. Go to railway.app → Sign up with GitHub
2. New Project → Deploy from GitHub → Select your backend repo
3. Add Variables: DATABASE_URL, JWT_SECRET
4. Railway auto-deploys and gives you a URL
5. Paste the URL into frontend/src/utils/api.js
