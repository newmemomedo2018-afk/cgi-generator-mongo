# ⚡ Quick Start: Deploy CGI Generator to Render

## 🚀 1-Minute Setup

### Step 1: Push to GitHub
```bash
git add .
git commit -m "feat: Ready for Render deployment"
git push origin main
```

### Step 2: Create Render Services
1. Go to [render.com](https://render.com) → Sign up with GitHub
2. **Create PostgreSQL Database**:
   - Name: `cgi-generator-db`
   - Plan: Free (for testing) or Starter ($7/month)
3. **Create Web Service**:
   - Connect your GitHub repo
   - Name: `cgi-generator`
   - Build: `npm install && npm run build`
   - Start: `npm run start`
   - Plan: Free (for testing) or Starter ($7/month)

### Step 3: Environment Variables
In Render Web Service → Environment, add:

```bash
# AI Service (Required)
GEMINI_API_KEY=your_gemini_api_key

# File Storage (Required)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key  
CLOUDINARY_API_SECRET=your_api_secret

# Payments (Required)
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
VITE_STRIPE_PUBLIC_KEY=pk_test_your_public

# Security (Required)
JWT_SECRET=your_32_character_secret

# System (Auto-configured)
NODE_ENV=production
PORT=10000
```

### Step 4: Update Stripe Webhook
- Go to Stripe Dashboard → Webhooks
- Update URL to: `https://your-app.onrender.com/api/webhooks/stripe`

## 🎉 Done!
Your CGI Generator will be live at: `https://your-app-name.onrender.com`

## 🔧 Getting API Keys

### Gemini AI (Free)
1. Visit: https://aistudio.google.com/app/apikey
2. Create API key → Copy

### Cloudinary (Free)
1. Sign up: https://cloudinary.com
2. Dashboard → Copy: Cloud Name, API Key, API Secret

### Stripe (Free)
1. Sign up: https://stripe.com
2. Dashboard → API Keys → Copy test keys
3. Set webhook URL in Webhooks section

## 🚨 Troubleshooting

### Build Fails
- Check logs in Render Dashboard
- Verify all dependencies in package.json

### Database Connection Error
- Ensure DATABASE_URL is auto-set by Render PostgreSQL
- Check database service is running

### Health Check Fails
- Visit: `https://your-app.onrender.com/api/health`
- Should return: `{"status":"healthy"}`

### Payments Don't Work
- Update Stripe webhook URL
- Verify STRIPE_WEBHOOK_SECRET matches
- Test with: 4242 4242 4242 4242

## 📈 Scaling
- **Free Tier**: Good for testing (sleeps after 15min)
- **Starter ($7/month)**: Always-on, recommended for production
- **Custom Domain**: Available on paid plans

Need detailed setup? See: `RENDER-DEPLOYMENT.md`