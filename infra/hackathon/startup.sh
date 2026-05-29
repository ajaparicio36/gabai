#!/bin/bash
set -euo pipefail

# ── Config (injected by Terraform templatefile) ─────────────────────
GIT_REPO_URL="${git_repo_url}"
GIT_BRANCH="${git_branch}"

# ── Install Docker ──────────────────────────────────────────────────
apt-get update && apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git

# ── Clone repo ──────────────────────────────────────────────────────
cd /opt
git clone --branch "$GIT_BRANCH" "$GIT_REPO_URL" gavai
cd gavai

# ── Create .env from example ────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
fi

chmod +x infra/hackathon/startup.sh 2>/dev/null || true

echo "============================================"
echo " Bootstrap complete. Next steps:"
echo "  1. SSH:  gcloud compute ssh gavai-vm --zone=${zone}"
echo "  2. Edit secrets:  vi /opt/gavai/.env"
echo "  3. Launch:  cd /opt/gavai && docker compose up -d"
echo "============================================"
