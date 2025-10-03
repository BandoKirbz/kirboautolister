# eBay OAuth Setup Instructions

## Required Environment Variables

Create a `.env.local` file in your project root with the following variables:

```env
# eBay OAuth Configuration
# Get these from your eBay Developer Account: https://developer.ebay.com/
EBAY_CLIENT_ID=your_ebay_app_id_here
EBAY_CLIENT_SECRET=your_ebay_cert_id_here
EBAY_RUNAME=your_ebay_ru_name_here
EBAY_SANDBOX=true

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here

# Database
DATABASE_URL="file:./dev.db"

# eBay API Configuration
EBAY_API_URL=https://api.sandbox.ebay.com
EBAY_REDIRECT_URI=http://localhost:3000/api/ebay/callback
```

## eBay Developer Account Setup

1. Go to [eBay Developer Account](https://developer.ebay.com/)
2. Create a new application or use an existing one
3. Configure the following settings:

   - **RuName (Redirect URL Name)**: This is what you'll use as `EBAY_RUNAME` - it's a short identifier like `YourApp_RuName`
   - **Redirect URI**: `http://localhost:3000/api/ebay/callback` (for development) - this is where users get redirected after auth
   - **Scopes**:
     - `https://api.ebay.com/oauth/api_scope`
     - `https://api.ebay.com/oauth/api_scope/sell.inventory`
     - `https://api.ebay.com/oauth/api_scope/sell.account`
     - `https://api.ebay.com/oauth/api_scope/sell.fulfillment`
     - `https://api.ebay.com/oauth/api_scope/sell.marketing`
     - `https://api.ebay.com/oauth/api_scope/sell.analytics.readonly`

4. Copy the following values from your eBay app:
   - **App ID** → `EBAY_CLIENT_ID`
   - **Cert ID** → `EBAY_CLIENT_SECRET`
   - **RuName** → `EBAY_RUNAME`

## How the OAuth Flow Works

1. User clicks "Connect to eBay" button
2. User is redirected to eBay's OAuth authorization page
3. User authorizes the application
4. eBay redirects back to `/api/ebay/callback` with authorization code
5. The callback route exchanges the code for access/refresh tokens
6. User is redirected back to dashboard with success/error status
7. The frontend detects the status from URL parameters and shows appropriate message

## Testing

1. Make sure all environment variables are set correctly
2. Start the development server: `npm run dev`
3. Navigate to the platforms page
4. Click "Connect to eBay"
5. Complete the OAuth flow on eBay's site
6. You should be redirected back to your dashboard with a success message

## Troubleshooting

- **"Invalid redirect URI"**: Make sure the redirect URI in your eBay app matches exactly: `http://localhost:3000/api/ebay/callback`
- **"Missing required eBay environment variables"**: Ensure all eBay environment variables are set in `.env.local`
- **"No authorization code received"**: Check that the redirect URI is correctly configured in both your eBay app and environment variables
- **"invalid_request" error**: This usually means the `redirect_uri` parameter in OAuth requests should be your RuName (not the full callback URL). The code has been fixed to use RuName for both auth URL and token exchange.
- **"Input request parameters are invalid"**: Double-check that your `EBAY_RUNAME` matches exactly what's configured in your eBay Developer Account

.env.local file context: 
# Local Development Database URL
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Authentication Configuration
NEXTAUTH_URL="https://your-tunnel-subdomain.loca.lt"
NEXTAUTH_SECRET="***REDACTED_NEXTAUTH_SECRET***"
NEXTAUTH_URL_INTERNAL="http://localhost:3000"

# eBay API Configuration (use sandbox for local development)
EBAY_CLIENT_ID="***REDACTED_EBAY_CLIENT_ID***"
EBAY_CLIENT_SECRET="***REDACTED_EBAY_CLIENT_SECRET***"
EBAY_CERT_ID="***REDACTED_EBAY_CERT_ID***"
EBAY_RUNAME="***REDACTED_EBAY_RUNAME***"
EBAY_SANDBOX=true
EBAY_ENVIRONMENT="SANDBOX"
EBAY_REDIRECT_URI=http://localhost:3000/api/ebay/callback
EBAY_API_URL=https://api.sandbox.ebay.com

# AWS S3 Configuration (can use localstack or actual S3)
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-1"
S3_BUCKET_NAME="your-bucket-name"

# Localtunnel Configuration
TUNNEL_URL="https://your-tunnel-subdomain.loca.lt"
