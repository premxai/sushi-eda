#!/bin/bash

# Deploy Frontend to Vercel
# Usage: ./scripts/deploy-frontend.sh [production|preview]

ENVIRONMENT=${1:-production}

echo "🚀 Deploying frontend to Vercel ($ENVIRONMENT)..."

cd frontend

if [ "$ENVIRONMENT" = "production" ]; then
    echo "📦 Deploying to production..."
    vercel --prod
elif [ "$ENVIRONMENT" = "preview" ]; then
    echo "📦 Deploying preview..."
    vercel
else
    echo "❌ Unknown environment: $ENVIRONMENT"
    echo "Usage: ./scripts/deploy-frontend.sh [production|preview]"
    exit 1
fi

echo "✅ Frontend deployed to Vercel!"
echo "🎉 Deployment complete!"
