# Deployment Guide

Complete guide for deploying LectureGen to production.

---

## Overview

LectureGen consists of two main components:

1. **Frontend** (Next.js) → Deploy to **Vercel**
2. **API** (Fastify with WebSockets) → Deploy to **Railway** or **Render**

⚠️ **Important:** The API is NOT recommended for Vercel because:
- It uses WebSockets (lecture generation, real-time Q&A)
- Lecture generation can take 2-5+ minutes (Vercel has 10s/60s timeouts)
- Requires persistent connections

---

## Recommended Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Frontend  │ ─────▶  │     API      │ ─────▶  │  Firebase   │
│   (Vercel)  │         │  (Railway)   │         │  (Auth/DB)  │
└─────────────┘         └──────────────┘         └─────────────┘
     │                         │
     │                         ├─────▶ Anthropic API (Claude)
     │                         ├─────▶ LiveKit (TTS)
     │                         └─────▶ Google Images
     │
     └─────▶ Firebase Auth (client-side)
```

---

## Part 1: Deploy Frontend to Vercel

### Prerequisites

- Vercel account
- GitHub repository connected to Vercel

### Step 1: Create Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Select **"frontend"** as the root directory

### Step 2: Configure Build Settings

Vercel should auto-detect Next.js. Verify these settings:

- **Framework Preset:** Next.js
- **Root Directory:** `frontend`
- **Build Command:** `pnpm build`
- **Output Directory:** `.next` (default)
- **Install Command:** `pnpm install`
- **Node Version:** 20.x

### Step 3: Environment Variables

Add these environment variables in Vercel dashboard:

```bash
# Firebase Client Config (from Firebase Console)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# API Endpoint (will be from Railway/Render)
NEXT_PUBLIC_API_URL=https://your-api-domain.railway.app
```

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait for build to complete
3. Your frontend will be live at `https://your-project.vercel.app`

### Step 5: Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Update DNS records as instructed

---

## Part 2: Deploy API to Railway

Railway is recommended for the API because it supports:
- ✅ WebSockets
- ✅ Long-running processes
- ✅ No timeout limits
- ✅ Persistent connections

### Prerequisites

- Railway account ([railway.app](https://railway.app))
- GitHub repository

### Step 1: Create Railway Project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **"Deploy from GitHub repo"**
3. Select your repository
4. Railway will detect it as a Node.js project

### Step 2: Configure Root Directory

Since your API is in a monorepo, you need to specify the root:

1. Go to **Settings** → **Service Settings**
2. Set **Root Directory:** `api`
3. Set **Build Command:** `pnpm install && pnpm build`
4. Set **Start Command:** `pnpm start`

### Step 3: Environment Variables

Add these in Railway dashboard (Variables tab):

```bash
# Node Environment
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# Anthropic (Claude)
ANTHROPIC_API_KEY=your_anthropic_key

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_PATH=/app/service-account-key.json
FIREBASE_STORAGE_BUCKET=your_bucket_name

# LiveKit (TTS)
LIVEKIT_API_KEY=your_livekit_key
LIVEKIT_API_SECRET=your_livekit_secret
LIVEKIT_BASE_URL=https://your-livekit-instance.livekit.cloud
LIVEKIT_DEFAULT_VOICE=your_voice_id

# Google Images (optional)
GOOGLE_CSE_ID=your_cse_id
GOOGLE_API_KEY=your_google_api_key
```

### Step 4: Add Firebase Service Account

Railway doesn't support uploading files directly, so you have two options:

#### Option A: Environment Variable (Recommended)
```bash
# Add as single-line JSON string
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

Then update `api/src/lib/firebase_admin.ts` to read from env:
```typescript
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : require(path.resolve(process.cwd(), 'service-account-key.json'));
```

#### Option B: Railway Volumes
1. Create a Railway Volume
2. Mount it to `/app/secrets`
3. Upload service account JSON there

### Step 5: Deploy

1. Railway will auto-deploy on push to main
2. Get your API URL from Railway dashboard (e.g., `https://your-api.railway.app`)
3. **Update frontend environment variable** `NEXT_PUBLIC_API_URL` with this URL
4. Redeploy frontend on Vercel

### Step 6: Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Click **"Generate Domain"** or add custom domain
3. Railway handles SSL automatically

---

## Alternative: Deploy API to Render

Render is another great option for the API.

### Quick Setup

1. Go to [render.com](https://render.com)
2. Click **"New +" → "Web Service"**
3. Connect GitHub repository
4. Configure:
   - **Root Directory:** `api`
   - **Build Command:** `pnpm install && pnpm build`
   - **Start Command:** `pnpm start`
   - **Instance Type:** Starter or Standard (for WebSockets)

5. Add environment variables (same as Railway list above)
6. Deploy

**Note:** Render's free tier spins down after inactivity. Use at least the Starter plan ($7/mo) for production.

---

## Part 3: Configure CORS

Once both are deployed, update API CORS settings:

In `api/src/server.ts`:

```typescript
await app.register(cors, {
  origin: [
    'http://localhost:3000',  // Local development
    'https://your-frontend.vercel.app',  // Production frontend
    'https://your-custom-domain.com',     // Custom domain if applicable
  ],
  credentials: true,
});
```

---

## Part 4: Update Frontend Environment

After API is deployed, update frontend's environment variables:

### On Vercel:

1. Go to **Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_API_URL` to your Railway/Render URL
3. Click **"Save"**
4. Redeploy frontend (or it will auto-deploy)

### In Code:

The frontend should read from `lib/env.ts`:

```typescript
export function getBackendEndpoint(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}
```

---

## Deployment Checklist

### Frontend (Vercel)
- [ ] GitHub repo connected
- [ ] Root directory set to `frontend`
- [ ] All Firebase env vars added
- [ ] `NEXT_PUBLIC_API_URL` points to deployed API
- [ ] Build succeeds
- [ ] Custom domain configured (optional)

### API (Railway/Render)
- [ ] GitHub repo connected
- [ ] Root directory set to `api`
- [ ] All environment variables added
- [ ] Firebase service account configured
- [ ] Build command: `pnpm install && pnpm build`
- [ ] Start command: `pnpm start`
- [ ] WebSocket connections working
- [ ] CORS configured with frontend URL
- [ ] Custom domain configured (optional)

### Integration Testing
- [ ] Frontend can connect to API
- [ ] Firebase auth works
- [ ] Lecture creation works (WebSocket)
- [ ] Lecture viewing works (WebSocket)
- [ ] TTS generation works
- [ ] Image fetching works
- [ ] Mermaid diagrams render

---

## Troubleshooting

### Frontend Issues

**Build fails with "Module not found: 'schema'"**
- Cause: Vercel doesn't support pnpm workspaces well
- Fix: Copy `types/` into `frontend/` or publish as npm package

**Firebase auth not working**
- Check all `NEXT_PUBLIC_FIREBASE_*` variables are set
- Verify API keys are correct from Firebase console

### API Issues

**WebSocket connection fails**
- Ensure Railway/Render instance is running (not sleeping)
- Check CORS allows frontend domain
- Verify frontend uses correct WebSocket URL (wss:// not ws://)

**Lecture generation times out**
- This is normal for Vercel (not recommended)
- Use Railway/Render instead
- Increase Railway instance resources if needed

**Environment variables not loading**
- Railway: Check Variables tab
- Render: Check Environment section
- Ensure no trailing spaces in values

**Firebase admin fails**
- Check `FIREBASE_SERVICE_ACCOUNT_JSON` is valid JSON
- Or verify `service-account-key.json` is accessible
- Test locally first with same env vars

---

## Cost Estimates

### Hobby/Development
- **Vercel:** Free (Hobby plan)
- **Railway:** ~$5/month (Starter)
- **Render:** Free tier (sleeps after inactivity) or $7/month (Starter)
- **Firebase:** Free tier (Spark plan) - generous limits
- **LiveKit:** Pay-as-you-go (~$0.0005/minute)
- **Anthropic:** Pay-as-you-go (~$3 per million input tokens)

**Total:** ~$15-20/month for moderate usage

### Production
- **Vercel:** $20/month (Pro plan)
- **Railway:** $20-50/month (depending on usage)
- **Firebase:** Blaze plan (pay-as-you-go, ~$25-50/month)
- **LiveKit:** ~$50-100/month
- **Anthropic:** ~$100-500/month (depending on usage)

**Total:** ~$200-700/month

---

## Monitoring & Logs

### Vercel (Frontend)
- **Analytics:** Built-in (free)
- **Logs:** Real-time in dashboard
- **Errors:** Integrated error tracking

### Railway (API)
- **Logs:** Real-time in dashboard
- **Metrics:** CPU, Memory, Network usage
- **Observability:** Integrate with Datadog/Sentry

### Recommended
- Add **Sentry** for error tracking
- Add **LogRocket** for session replay
- Add **Datadog** for full observability

---

## CI/CD

### Automatic Deployments

Both Vercel and Railway support automatic deployments:

- **Production:** Deploys on push to `main` branch
- **Preview:** Deploys on pull requests (Vercel only)

### Manual Deployments

**Vercel CLI:**
```bash
cd frontend
vercel --prod
```

**Railway CLI:**
```bash
cd api
railway up
```

---

## Security Checklist

- [ ] All API keys in environment variables (not committed)
- [ ] Firebase security rules configured
- [ ] CORS restricted to frontend domain
- [ ] Rate limiting enabled on API
- [ ] HTTPS enforced (automatic on Vercel/Railway)
- [ ] Service account JSON not in Git
- [ ] Environment variables encrypted (automatic)

---

## Next Steps

1. Deploy frontend to Vercel
2. Deploy API to Railway
3. Test integration
4. Set up custom domains
5. Configure monitoring
6. Set up error tracking
7. Load test with realistic traffic

Need help? Check the troubleshooting section or reach out to the team.
