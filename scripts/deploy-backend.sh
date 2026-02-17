#!/bin/bash

# Deploy Backend to Railway/Render
# Usage: ./scripts/deploy-backend.sh [railway|render]

PLATFORM=${1:-railway}

echo "🚀 Deploying backend to $PLATFORM..."

if [ "$PLATFORM" = "railway" ]; then
    echo "📦 Deploying to Railway..."
    cd backend
    railway up
    echo "✅ Backend deployed to Railway!"
    
elif [ "$PLATFORM" = "render" ]; then
    echo "📦 Deploying to Render..."
    echo "Please push to your Git repository. Render will auto-deploy."
    echo "Or use: render deploy"
    
else
    echo "❌ Unknown platform: $PLATFORM"
    echo "Usage: ./scripts/deploy-backend.sh [railway|render]"
    exit 1
fi

echo "🎉 Deployment complete!"
