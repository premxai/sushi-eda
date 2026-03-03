# 🚀 DevWhisperer Deployment Guide

## Pre-Deployment Checklist

### ✅ Backend Ready
- [x] Rate limiting configured (10 requests/minute)
- [x] Logging with loguru (logs/app.log)
- [x] In-memory caching with MD5 hashing
- [x] Health check endpoint at `/health`
- [x] Dockerfile created
- [x] Railway and Render configs included
- [x] Error handling and validation

### ✅ Frontend Ready
- [x] Environment variables configured
- [x] SEO meta tags and Open Graph tags
- [x] Standalone build for Docker
- [x] Dockerfile with multi-stage build
- [x] Vercel configuration
- [x] Production optimizations enabled

### ✅ Documentation
- [x] Comprehensive README.md
- [x] API documentation
- [x] Deployment instructions
- [x] Sample datasets included
- [x] Test scripts created
- [x] MIT License

## Quick Deploy Commands

### Backend to Railway
```bash
cd backend
railway login
railway init
railway up
```

### Backend to Render
```bash
# Push to GitHub, then:
# 1. Connect repo to Render
# 2. Create Web Service
# 3. Render auto-deploys using render.yaml
```

### Frontend to Vercel
```bash
cd frontend
vercel login
vercel --prod
```

### Full Stack with Docker
```bash
docker-compose up --build -d
```

## Environment Variables

### Backend (Railway/Render)
No environment variables required. All configuration is in code.

### Frontend (Vercel)
**Required** - Set these in Vercel dashboard (Settings → Environment Variables):

1. **Clerk Authentication** (Get from https://dashboard.clerk.com → Your App → API Keys)
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_test_...` or `pk_live_...`
   - `CLERK_SECRET_KEY` = `sk_test_...` or `sk_live_...`

2. **Backend API**
   - `NEXT_PUBLIC_API_URL` = Your backend URL (e.g., `https://sushi-backend-y9er.onrender.com`)

3. **Optional Configuration**
   - `NEXT_PUBLIC_SITE_URL` = Your frontend URL (e.g., `https://sushi-eda.vercel.app`)
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL` = `/sign-in` (default)
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL` = `/sign-up` (default)
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` = `/dashboard` (default)
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` = `/dashboard` (default)

**⚠️ Important:** Without Clerk environment variables, the build will fail. Create a free account at https://clerk.com if you don't have one.

## Post-Deployment Verification

1. **Backend Health Check**
   ```bash
   curl https://your-backend-url.com/health
   ```
   Expected: `{"status": "ok", "version": "1.0.0", ...}`

2. **Frontend Accessibility**
   ```bash
   curl -I https://your-frontend-url.vercel.app
   ```
   Expected: HTTP 200

3. **Upload Test**
   ```bash
   curl -X POST https://your-backend-url.com/upload \
     -F "file=@sample_data/sales_data.csv"
   ```
   Expected: JSON with analysis results

4. **CORS Test**
   - Open frontend in browser
   - Upload a file
   - Verify no CORS errors in console

## Monitoring

### Backend Logs (Railway)
```bash
railway logs
```

### Backend Logs (Render)
View in Render dashboard under "Logs" tab

### Frontend Logs (Vercel)
View in Vercel dashboard under "Deployments" > "Functions"

## Troubleshooting

### Issue: CORS errors
**Solution:** Ensure backend CORS middleware allows your frontend domain

### Issue: 429 Rate Limit errors
**Solution:** Rate limit is 10 requests/minute. Wait or adjust in `main.py`

### Issue: File upload fails
**Solution:** Check file size (<100MB) and format (CSV, Excel, JSON)

### Issue: Frontend can't reach backend
**Solution:** Verify `NEXT_PUBLIC_API_URL` is set correctly in Vercel

## Scaling Considerations

### Backend
- **Railway**: Auto-scales based on traffic
- **Render**: Upgrade to paid plan for auto-scaling
- **Caching**: Currently in-memory, consider Redis for multi-instance deployments

### Frontend
- **Vercel**: Auto-scales globally via CDN
- **Static assets**: Automatically optimized and cached

## Security Notes

- Rate limiting prevents abuse (10 req/min per IP)
- File size validation (100MB limit)
- No sensitive data stored (all in-memory)
- CORS configured for specific origins in production
- Logs rotation configured (500MB, 10 days retention)

## Cost Estimates

### Free Tier Deployment
- **Railway**: $5/month credit (sufficient for hobby projects)
- **Render**: Free tier available (sleeps after inactivity)
- **Vercel**: Free tier (100GB bandwidth, unlimited requests)

**Total**: $0-5/month for hobby use

### Production Deployment
- **Railway**: ~$10-20/month (always-on, higher resources)
- **Render**: ~$7-25/month (paid plans)
- **Vercel**: ~$20/month (Pro plan for team features)

**Total**: ~$37-65/month for production

## Backup & Recovery

### Data
- No persistent data storage (stateless application)
- Analysis results cached in-memory only
- No backup needed for application state

### Code
- Version controlled in Git
- Deployments are reproducible from repository
- Rollback via platform dashboards or Git revert

## Next Steps After Deployment

1. **Add Custom Domain** (optional)
   - Backend: Configure in Railway/Render
   - Frontend: Configure in Vercel

2. **Set Up Monitoring** (optional)
   - Integrate Sentry for error tracking
   - Add Google Analytics for usage metrics

3. **Enable HTTPS** (automatic)
   - Railway, Render, and Vercel provide SSL certificates automatically

4. **Create Screenshots**
   - Take screenshots of deployed app
   - Add to README.md

5. **Share & Promote**
   - Add to GitHub
   - Share on social media
   - Submit to product directories

---

**Deployment Status**: ✅ Ready for Production

Last Updated: February 15, 2026
