#!/bin/bash

# Test all features of DevWhisperer
# Usage: ./scripts/test-all.sh

echo "🧪 Testing DevWhisperer EDA Platform..."
echo ""

# Check if backend is running
echo "1️⃣ Testing backend health..."
HEALTH=$(curl -s http://localhost:8000/health)
if [ $? -eq 0 ]; then
    echo "✅ Backend is healthy: $HEALTH"
else
    echo "❌ Backend is not responding. Start with: cd backend && uvicorn main:app"
    exit 1
fi

echo ""
echo "2️⃣ Testing file upload..."
if [ -f "sample_data/sales_data.csv" ]; then
    RESPONSE=$(curl -s -X POST http://localhost:8000/upload \
        -F "file=@sample_data/sales_data.csv")
    if [ $? -eq 0 ]; then
        echo "✅ File upload successful"
    else
        echo "❌ File upload failed"
        exit 1
    fi
else
    echo "⚠️  Sample data not found. Skipping upload test."
fi

echo ""
echo "3️⃣ Testing frontend..."
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$FRONTEND" = "200" ]; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend is not responding. Start with: cd frontend && npm run dev"
    exit 1
fi

echo ""
echo "✅ All tests passed!"
echo "🎉 DevWhisperer is ready to use!"
