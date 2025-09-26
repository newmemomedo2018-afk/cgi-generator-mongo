# 🚀 Render Deployment Guide - CGI Generator

## Step 1: Prepare Your GitHub Repository

### 1.1 Create GitHub Repository
```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit initial code
git commit -m "feat: CGI Generator ready for Render deployment"

# Add GitHub remote origin
git remote add origin https://github.com/yourusername/cgi-generator.git

# Push to GitHub
git push -u origin main
```

### 1.2 Repository Settings
- **Repository name**: `cgi-generator`
- **Visibility**: Private (recommended for SaaS)
- **Branch**: `main` (default branch)

## Step 2: Render Platform Setup

### 2.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub account
3. Connect your GitHub repository

### 2.2 Create PostgreSQL Database
1. In Render Dashboard → Create New → PostgreSQL
2. Settings:
   - **Name**: `cgi-generator-db`
   - **Database**: `cgi_generator`
   - **User**: `cgi_user`
   - **Region**: Select closest to your users
   - **Plan**: Free tier for testing, Starter for production

### 2.3 Create Web Service
1. In Render Dashboard → Create New → Web Service
2. Connect your GitHub repository
3. Configure settings:
   - **Name**: `cgi-generator`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Instance Type**: Free tier for testing, Starter for production

## Step 3: Environment Variables Setup

In Render Web Service → Environment:

### Required Environment Variables
```bash
# Database (auto-generated from PostgreSQL service)
DATABASE_URL=postgresql://cgi_user:password@host/cgi_generator

# AI Services
GEMINI_API_KEY=your_gemini_api_key_here

# File Storage
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Payment Processing
STRIPE_SECRET_KEY=sk_test_or_live_your_stripe_secret
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Authentication
JWT_SECRET=your_secure_jwt_secret_minimum_32_chars

# System
NODE_ENV=production
PORT=10000
```

### Frontend Environment Variables (for client build)
```bash
# Add these with VITE_ prefix for frontend access
VITE_STRIPE_PUBLIC_KEY=pk_test_or_live_your_stripe_public
```

## Step 4: Database Migration

### 4.1 Connect to Database
```bash
# Install PostgreSQL client locally
npm install -g pg

# Connect to your Render PostgreSQL (get connection string from Render dashboard)
psql $DATABASE_URL
```

### 4.2 Run Database Setup
```bash
# Push schema to database
npm run db:push
```

## Step 5: Deploy Application

### 5.1 Automatic Deployment
- Render automatically deploys when you push to GitHub
- Monitor deployment logs in Render Dashboard
- First deployment may take 10-15 minutes

### 5.2 Manual Deployment (if needed)
1. Go to Render Dashboard → Your Service
2. Click "Manual Deploy" → "Deploy latest commit"

## Step 6: Configure Webhooks & External Services

### 6.1 Update Stripe Webhook
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Developers → Webhooks
3. Add endpoint: `https://your-app-name.onrender.com/api/webhooks/stripe`
4. Events to send:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

### 6.2 Test Payment Integration
- Use Stripe test mode first
- Test card: `4242 4242 4242 4242`
- Verify credit fulfillment works

## Step 7: Custom Domain (Optional)

### 7.1 Add Custom Domain in Render
1. Render Dashboard → Your Service → Settings
2. Custom Domains → Add Domain
3. Enter: `cgi-generator.com`
4. Copy the DNS records provided

### 7.2 Configure DNS
1. In your domain registrar (Namecheap, etc.)
2. Add CNAME record:
   ```
   Type: CNAME
   Name: @
   Value: your-app-name.onrender.com
   TTL: 300 (or Auto)
   ```

### 7.3 SSL Certificate
- Render automatically provisions SSL certificates
- Wait 24-48 hours for full propagation

## Step 8: Production Testing

### 8.1 Core Functionality Test
- [ ] Health check: `https://your-app.onrender.com/api/health`
- [ ] User registration/login
- [ ] Credit package purchase
- [ ] Image generation (2 credits)
- [ ] Video generation short (13 credits)
- [ ] Video generation long (18 credits)
- [ ] Audio enhancement (+5 credits)
- [ ] Download generated content

### 8.2 Performance Monitoring
- [ ] Check Render service logs
- [ ] Monitor database connections
- [ ] Verify AI service responses
- [ ] Test file upload/storage

## Step 9: Scaling & Optimization

### 9.1 Upgrade Plans
- **Free Tier**: Good for testing
- **Starter Plan**: $7/month - recommended for production
- **Standard Plan**: $25/month - high traffic

### 9.2 Performance Tips
- Enable auto-deploy from GitHub
- Monitor service metrics in Render dashboard
- Set up health checks for monitoring
- Use database connection pooling

## Troubleshooting

### Common Issues & Solutions

#### "Build Failed"
- Check build logs in Render dashboard
- Verify package.json scripts are correct
- Ensure all dependencies are in package.json

#### "Database Connection Failed"
- Verify DATABASE_URL is correctly set
- Check database service is running
- Ensure database accepts external connections

#### "Environment Variables Missing"
- Double-check all required env vars are set
- Restart service after adding new variables
- Verify sensitive variables are marked as secret

#### "Stripe Webhook Fails"
- Update webhook URL in Stripe dashboard
- Verify STRIPE_WEBHOOK_SECRET matches
- Check webhook event types are correct

## Rollback Plan

If deployment fails:
1. Check GitHub for last working commit
2. In Render: Manual Deploy → Select previous commit
3. Fix issues in development
4. Push new commit to trigger auto-deploy

## Monitoring & Maintenance

- **Logs**: Render Dashboard → Service → Logs
- **Metrics**: Monitor CPU, memory, requests
- **Database**: Monitor connection count and performance
- **Costs**: Track usage in Render billing

## 🎉 Your CGI Generator is now live on Render!

Access your application at: `https://your-app-name.onrender.com`