#!/bin/bash
set -e

echo "🚀 Setting up Sara VPS..."

# Update system
apt-get update -y
apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Create Sara user
useradd -m -s /bin/bash sara || true
mkdir -p /home/sara/.saraclaw

# Clone Sara repository
cd /home/sara
# Check if repo already exists
if [ -d "saraclaw" ]; then
    echo "Directory saraclaw already exists, pulling latest..."
    cd saraclaw
    git pull
else
    git clone https://github.com/somaverso/saraclaw.git
    cd saraclaw
fi

# Configure environment
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Please edit /home/sara/saraclaw/.env with your API keys"
fi

# Install dependencies
npm install

# Build
npm run build

echo "✅ VPS setup complete!"
echo "   Next steps:"
echo "   1. Edit .env: nano /home/sara/saraclaw/.env"
echo "   2. Run Sara: docker-compose up -d"
echo "   3. Check health: sara doctor"
