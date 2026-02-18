#!/bin/bash
set -e

# ─── CONFIGURATION ───────────────────────────────────
DO_API_TOKEN="${DO_API_TOKEN:?'DO_API_TOKEN is required'}"
DROPLET_NAME="sara-$(date +%Y%m%d)"
DROPLET_SIZE="s-2vcpu-4gb"     # 2 vCPU, 4GB RAM = ~$24/month
DROPLET_REGION="nyc3"           # NYC (or sfo3 for closer to Brazil)
DROPLET_IMAGE="ubuntu-24-04-x64"

echo "🚀 Creating DigitalOcean Droplet: $DROPLET_NAME"

RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $DO_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$DROPLET_NAME\",
    \"region\": \"$DROPLET_REGION\",
    \"size\": \"$DROPLET_SIZE\",
    \"image\": \"$DROPLET_IMAGE\",
    \"user_data\": \"$(cat scripts/setup-vps.sh | base64 -w 0)\"
  }" \
  https://api.digitalocean.com/v2/droplets)

DROPLET_ID=$(echo $RESPONSE | jq -r '.droplet.id')

echo "✅ Droplet created (ID: $DROPLET_ID)"
echo "⏳ Waiting for IP assignment..."

sleep 30

# Get IP
DROPLET_IP=$(curl -s \
  -H "Authorization: Bearer $DO_API_TOKEN" \
  "https://api.digitalocean.com/v2/droplets/$DROPLET_ID" \
  | jq -r '.droplet.networks.v4[0].ip_address')

echo "🎉 Deployment complete!"
echo "   Droplet: $DROPLET_NAME"
echo "   IP: $DROPLET_IP"
echo "   Sara URL: http://$DROPLET_IP:3000"
