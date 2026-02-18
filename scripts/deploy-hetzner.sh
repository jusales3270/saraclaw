#!/bin/bash
set -e

# ─── CONFIGURATION ───────────────────────────────────
HETZNER_API_TOKEN="${HETZNER_API_TOKEN:?'HETZNER_API_TOKEN is required'}"
SERVER_NAME="sara-$(date +%Y%m%d)"
SERVER_TYPE="cx21"              # 2 vCPU, 4GB RAM = ~$6/month
SERVER_LOCATION="nbg1"          # Nuremberg (low latency Brazil)
SERVER_IMAGE="ubuntu-24.04"

# ─── CREATE SERVER ─────────────────────────────────

echo "🚀 Creating Hetzner server: $SERVER_NAME"

RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $HETZNER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$SERVER_NAME\",
    \"server_type\": \"$SERVER_TYPE\",
    \"location\": \"$SERVER_LOCATION\",
    \"image\": \"$SERVER_IMAGE\",
    \"user_data\": \"$(cat scripts/setup-vps.sh | base64 -w 0)\"
  }" \
  https://api.hetzner.cloud/v1/servers)

SERVER_ID=$(echo $RESPONSE | jq -r '.server.id')
SERVER_IP=$(echo $RESPONSE | jq -r '.server.public_net.ipv4.ip')

echo "✅ Server created!"
echo "   ID: $SERVER_ID"
echo "   IP: $SERVER_IP"

# ─── WAIT FOR BOOT ─────────────────────────────────

echo "⏳ Waiting for server to boot..."
sleep 30

# ─── COPY ENV FILE ─────────────────────────────────

if [ -f .env ]; then
  echo "📋 Copying .env file..."
  # StrictHostKeyChecking=no is risky but needed for auto-deploy
  scp -o StrictHostKeyChecking=no .env root@$SERVER_IP:/home/sara/saraclaw/.env
fi

# ─── START SARA ────────────────────────────────────

echo "🚀 Starting Sara..."
ssh -o StrictHostKeyChecking=no root@$SERVER_IP << 'EOF'
  cd /home/sara/saraclaw
  docker-compose up -d
  echo "Sara started!"
EOF

echo ""
echo "🎉 Deployment complete!"
echo "   Server: $SERVER_NAME"
echo "   IP: $SERVER_IP"
echo "   Sara URL: http://$SERVER_IP:3000"
echo "   API URL: http://$SERVER_IP:3001"
echo ""
echo "   SSH: ssh root@$SERVER_IP"
echo "   Logs: ssh root@$SERVER_IP 'docker-compose logs -f'"
