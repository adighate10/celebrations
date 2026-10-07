#!/bin/bash
# Runs on the server as root. deploy.sh uploads this next to the binary and runs it through
# Systems Manager on every deploy, so the server's configuration always matches the repo.
#
#   server-setup.sh <bucket> <region> [port]
set -euo pipefail
BUCKET="$1"
REGION="$2"
PORT="${3:-8080}"

id celebrations >/dev/null 2>&1 ||
  useradd --system --home /var/lib/celebrations --create-home --shell /sbin/nologin celebrations
install -d /opt/celebrations

# Optional settings for the app. The Gemini key is a SecureString you store yourself (see the
# README); without it the "describe them" box simply stays hidden. The key is never printed.
ENV_FILE=/etc/celebrations.env
install -m 600 /dev/null "$ENV_FILE"
if KEY="$(aws ssm get-parameter --region "$REGION" --name /celebrations/gemini-api-key \
  --with-decryption --query Parameter.Value --output text 2>/dev/null)"; then
  printf 'GEMINI_API_KEY=%s\n' "$KEY" >>"$ENV_FILE"
  echo "Gemini key: found, AI avatars on"
else
  echo "Gemini key: not set, AI avatars off"
fi
if URI="$(aws ssm get-parameter --region "$REGION" --name /celebrations/mongodb-uri \
  --with-decryption --query Parameter.Value --output text 2>/dev/null)"; then
  printf 'MONGODB_URI=%s\n' "$URI" >>"$ENV_FILE"
  echo "Database: MongoDB"
else
  echo "Database: not set, stages are kept in a file on this server"
fi
if MODEL="$(aws ssm get-parameter --region "$REGION" --name /celebrations/gemini-model \
  --query Parameter.Value --output text 2>/dev/null)"; then
  printf 'GEMINI_MODEL=%s\n' "$MODEL" >>"$ENV_FILE"
fi

cat >/etc/systemd/system/celebrations.service <<EOF
[Unit]
Description=Celebrations
After=network-online.target
Wants=network-online.target

[Service]
User=celebrations
WorkingDirectory=/var/lib/celebrations
EnvironmentFile=$ENV_FILE
ExecStart=/opt/celebrations/celebrations -addr :$PORT -data /var/lib/celebrations/stages.json
Restart=always
RestartSec=2
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/celebrations

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable celebrations >/dev/null 2>&1

aws s3 cp "s3://$BUCKET/celebrations" /opt/celebrations/celebrations.new --region "$REGION" --only-show-errors
chmod 755 /opt/celebrations/celebrations.new
mv /opt/celebrations/celebrations.new /opt/celebrations/celebrations
systemctl restart celebrations
sleep 4
echo "App: $(systemctl is-active celebrations)"
journalctl -u celebrations -n 6 --no-pager -o cat | grep -iE "stored in|mongo|database" || true
