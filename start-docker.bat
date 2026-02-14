@echo off
echo 🚀 Starting Pictionary with Docker...

echo 🛑 Stopping existing containers...
docker-compose down --remove-orphans

echo 🔨 Building and starting services...
docker-compose up --build -d

echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak

echo 📊 Container status:
docker-compose ps

echo.
echo ✅ Pictionary is running!
echo 🌐 Web App: http://localhost:3001
echo 🗄️  Database: localhost:5432
echo 🔴 Redis: localhost:6379
echo.
echo 📋 To view logs: docker-compose logs -f
echo 🛑 To stop: docker-compose down
pause