#!/bin/bash
# Deja programado en tu Mac que el respaldo se intente al encender/iniciar
# sesión y después cada hora (el script solo guarda uno nuevo si el último tiene
# 1 día o más). Así, si la Mac estuvo apagada o sin internet, se hace en cuanto
# vuelva a estar disponible.
#
# Uso:   bash scripts/instalar-respaldo-automatico.sh
# Quitar: launchctl unload ~/Library/LaunchAgents/com.frutalyogurt.respaldo.plist
set -e
BACKEND="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
[ -z "$NODE" ] && { echo "No encuentro node. Instálalo o abre una terminal donde funcione 'npm'."; exit 1; }
CARPETA="$HOME/Respaldos Frutal Yogurt"
PLIST="$HOME/Library/LaunchAgents/com.frutalyogurt.respaldo.plist"
mkdir -p "$CARPETA" "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.frutalyogurt.respaldo</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$BACKEND/scripts/respaldo.js</string>
  </array>
  <key>WorkingDirectory</key><string>$BACKEND</string>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>3600</integer>
  <key>StandardOutPath</key><string>$CARPETA/log.txt</string>
  <key>StandardErrorPath</key><string>$CARPETA/log.txt</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "✅ Respaldo automático programado (revisa cada hora y al encender la Mac; guarda uno al día)."
echo "   Se guardan en: $CARPETA"
echo "Haciendo el primer respaldo ahora..."
cd "$BACKEND" && "$NODE" scripts/respaldo.js --ya
