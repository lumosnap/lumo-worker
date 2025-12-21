#!/bin/bash

echo "🚀 Setting up LumoSnap Local Development Environment"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Start PostgreSQL container
echo "📦 Starting PostgreSQL container..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Check if database is responding
until docker exec lumosnap_postgres_1 pg_isready -U postgres; do
    echo "⏳ Waiting for PostgreSQL..."
    sleep 2
done

echo "✅ Database is ready!"

# Generate and run migrations
echo "🔄 Generating database schema..."
npm run db:generate:local

echo "⬆️ Running database migrations..."
npm run db:migrate:local

# Seed data (optional)
echo "🌱 Seeding development data..."
npm run db:seed:local

echo "🎉 Local development environment is ready!"
echo "📊 Database: postgresql://postgres:postgres@localhost:5432/lumosnap_dev"
echo "🔗 API Server: npm run dev"
echo "📚 API Documentation: http://localhost:8787/reference?key=b4582a0e41d4b49ff1e03018843c9eaf"