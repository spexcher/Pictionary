#!/bin/bash

echo "🚀 Starting Pictionary with Docker..."

# Stop and remove existing containers
echo "🛑 Stopping existing containers..."
docker-compose down --remove-orphans

# Build and start services
echo "🔨 Building and starting services..."
docker-compose up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Show status
echo "📊 Container status:"
docker-compose ps

echo ""
echo "✅ Pictionary is running!"
echo "🌐 Web App: http://localhost:3001"
echo "🗄️  Database: localhost:5432"
echo "🔴 Redis: localhost:6379"
echo ""
echo "📋 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down"