#!/bin/bash

# GigPredict AI Backend Setup Guide
# Quick start for running the complete backend system

echo "🚀 GigPredict AI Backend Setup"
echo "=============================="
echo ""

# Step 1: Install dependencies
echo "📦 Step 1: Installing Node dependencies..."
cd backend
npm install
echo "✓ Dependencies installed"
echo ""

# Step 2: Setup PostgreSQL
echo "🗄️  Step 2: Setting up PostgreSQL database..."
echo "Create database:"
psql -U postgres -c "CREATE DATABASE gigpredict_ai_dev;"
echo ""
echo "Load schema:"
psql -U postgres -d gigpredict_ai_dev -f ../database/schema.sql
echo "✓ Database schema loaded"
echo ""

# Step 3: Create .env file
echo "⚙️  Step 3: Creating environment file..."
cat > .env << EOF
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gigpredict_ai_dev
DB_USER=postgres
DB_PASS=postgres

AI_ENGINE_URL=http://localhost:5001
FRONTEND_URL=http://localhost:3000

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=5000

JWT_SECRET=your-secret-key-change-in-production
EOF
echo "✓ Environment file created"
echo ""

# Step 4: Seed database
echo "🌱 Step 4: Seeding database with test data..."
node src/utils/seedData.js 100
echo "✓ Test data generated (100 workers)"
echo ""

# Step 5: Start backend
echo "🚀 Step 5: Starting backend server..."
echo ""
echo "Choose how to start:"
echo "  1) npm run dev    - Start with nodemon (development)"
echo "  2) npm start      - Start production server"
echo ""
echo "Recommended for development: npm run dev"
echo ""
echo "Once started, the API will be available at: http://localhost:5000"
echo ""
echo "📝 Next steps:"
echo "  1. In another terminal, start the frontend: npm start (from frontend/)"
echo "  2. Run tests: bash docs/TEST_PIPELINE.sh"
echo "  3. Check API docs: cat docs/API_REFERENCE.md"
echo ""
echo "✨ Backend is ready!"
