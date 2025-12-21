#!/bin/bash

# LumoSnap Development Setup Script

set -e

echo "🚀 Setting up LumoSnap Development Environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "📦 Starting local PostgreSQL database..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Check if database is ready
until docker-compose -f docker-compose.dev.yml exec postgres pg_isready -U postgres; do
    echo "🔄 Waiting for postgres..."
    sleep 2
done

echo "✅ Database is ready!"

# Generate database schema for local development
echo "🔧 Generating database schema..."
npm run db:generate:local

# Run migrations
echo "🗄️ Running database migrations..."
npm run db:migrate:local

echo "🎉 Development environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Start the development server: npm run dev"
echo "2. Visit http://localhost:8787 for the API"
echo "3. Visit http://localhost:8787/reference?key=YOUR_API_KEY for docs"
echo ""
echo "🛑 To stop the database: docker-compose -f docker-compose.dev.yml down"