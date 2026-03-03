# Vercel Deployment Setup Guide

## 🚨 Quick Fix for Current Build Failure

Your build is failing because **Clerk authentication environment variables are missing**. Follow these steps:

### Step 1: Get Clerk Credentials

1. Go to https://dashboard.clerk.com
2. Sign in or create a free account
3. Create a new application (or select your existing one)
4. Navigate to **API Keys** in the sidebar
5. Copy these two keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_test_` or `pk_live_`)
   - `CLERK_SECRET_KEY` (starts with `sk_test_` or `sk_live_`)

### Step 2: Add Environment Variables to Vercel

1. Go to https://vercel.com/dashboard
2. Select your **sushi-eda** project
3. Click **Settings** → **Environment Variables**
4. Add the following variables (click "Add New"):

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` (from Clerk) | Production, Preview, Development |
| `CLERK_SECRET_KEY` | `sk_test_...` (from Clerk) | Production, Preview, Development |
| `NEXT_PUBLIC_API_URL` | `https://sushi-backend-y9er.onrender.com` | Production, Preview, Development |

**⚠️ Important:** 
- Make sure to select **all three environments** (Production, Preview, Development) for each variable
- The `CLERK_SECRET_KEY` should be marked as "Sensitive" (Vercel does this automatically)

### Step 3: Redeploy

After adding the environment variables:

1. Go to **Deployments** tab in Vercel
2. Find the latest (failed) deployment
3. Click the **•••** menu → **Redeploy**

OR simply push a new commit to trigger a fresh deployment:

```bash
git commit --allow-empty -m "redeploy: trigger build with env vars"
git push origin main
```

### Step 4: Verify

Your build should now succeed! Check the deployment logs for:
- ✅ `Linting and checking validity of types ...` (passed)
- ✅ `Generating static pages` (completed without errors)
- ✅ `Build completed successfully`

---

## Optional: Local Setup

To run the app locally with authentication:

1. Copy the example environment file:
   ```bash
   cd frontend
   cp .env.example .env.local
   ```

2. Add your Clerk keys to `frontend/.env.local`:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

---

## Troubleshooting

### Build still fails after adding env vars
- **Solution:** Ensure you selected all three environments when adding the variables
- Try deleting and re-adding the variables
- Make sure there are no extra spaces in the keys

### "Missing publishableKey" error persists
- **Solution:** The variable name must be exactly `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Check for typos in the variable name
- Verify the key starts with `pk_test_` or `pk_live_`

### Pages load but authentication doesn't work
- **Solution:** Check that `CLERK_SECRET_KEY` is set correctly
- Verify your Clerk app is active in the Clerk dashboard
- Check browser console for specific error messages

---

**Need Help?** Check the [Clerk Next.js Documentation](https://clerk.com/docs/quickstarts/nextjs)
