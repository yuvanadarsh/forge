#!/bin/bash
set -e

FORGE_DIR="$HOME/.forge"
REPO_RAW="https://raw.githubusercontent.com/yuvanadarsh/forge/main"

echo "⚡ Installing Forge..."
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is required but not installed."
  echo "   Install Docker Desktop from https://docker.com and try again."
  exit 1
fi

if ! docker info &> /dev/null; then
  echo "❌ Docker is installed but not running."
  echo "   Start Docker Desktop and try again."
  exit 1
fi

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
  echo "❌ PostgreSQL is required but not found."
  echo "   Install with: brew install postgresql"
  exit 1
fi

# Create Forge directory
mkdir -p "$FORGE_DIR"
cd "$FORGE_DIR"

# Download config files
echo "📥 Downloading Forge configuration..."
curl -fsSL "$REPO_RAW/docker-compose.prod.yml" -o docker-compose.yml
curl -fsSL "$REPO_RAW/.env.example" -o .env.example

# Setup .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  SECRET_KEY=$(openssl rand -hex 32)
  sed -i.bak "s/SECRET_KEY=/SECRET_KEY=$SECRET_KEY/" .env
  rm -f .env.bak
  echo ""
  echo "📝 Created .env file. Please edit $FORGE_DIR/.env with your database credentials."
  echo "   Required: DB_USER, DB_PASSWORD, DB_NAME"
  echo ""
  # Read from the terminal, not stdin — under `curl | bash` stdin is the
  # script itself and a bare `read` would abort the install at EOF.
  read -p "Press Enter after editing .env to continue..." < /dev/tty || true
fi

# Load env
export $(grep -v '^#' .env | xargs)

# Create database
echo "🗄️  Setting up database..."
psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "   Database already exists, skipping."

# Run migrations
echo "📋 Running migrations..."
MIGRATION_URL="$REPO_RAW/backend/db/migrations/001_initial.sql"
curl -fsSL "$MIGRATION_URL" | psql -U "$DB_USER" -d "$DB_NAME" 2>/dev/null || echo "   Migrations already applied."

# Pull and start
echo "🐳 Pulling Forge images..."
docker compose pull

echo "🚀 Starting Forge..."
docker compose up -d

echo ""
echo "✅ Forge is running!"
echo "   Open: http://localhost:3000"
echo "   Go to Settings → add your Anthropic API key to get started"
echo ""
echo "   To stop:   cd $FORGE_DIR && docker compose down"
echo "   To update: cd $FORGE_DIR && docker compose pull && docker compose up -d"
