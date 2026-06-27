#!/usr/bin/env bash
#
# End-to-end test for the inbound voice robot. Simulates a Twilio call: posts to
# /api/voice/incoming, then walks the qualify script through /api/voice/turn,
# chaining the slot state from each response's <Gather action="…"> just like
# Twilio would. Prints what the robot says at each step.
#
# Usage:
#   SITE_URL=http://localhost:3000 ./test-voice.sh
#   # walk a custom script:
#   SITE_URL=http://localhost:3000 FROM="+16025551234" \
#     UTTERANCES="i'm a debt buyer|Arizona|yes" ./test-voice.sh
#
# Signature note: the routes accept unsigned posts ONLY when TWILIO_AUTH_TOKEN
# is unset on the server (dev fallback). With a token set, Twilio's signature is
# required and this script can't forge it — run it against a dev server.

set -euo pipefail

SITE_URL="${SITE_URL:-http://localhost:3000}"
FROM="${FROM:-+16025551234}"
# Default script: segment -> state -> consent(text)
UTTERANCES="${UTTERANCES:-i am a debt buyer|Arizona|yes please text me}"

say_of() { grep -o '<Say[^>]*>[^<]*</Say>' | sed -E 's/<[^>]+>//g'; }
action_of() { grep -o 'action="[^"]*"' | head -1 | sed -E 's/action="([^"]*)"/\1/'; }

echo "→ POST $SITE_URL/api/voice/incoming"
RESP=$(curl -sS -X POST -H "Content-Type: application/x-www-form-urlencoded" \
  --data "From=$FROM&CallSid=CAtest123" \
  "$SITE_URL/api/voice/incoming")
echo "  ROBOT: $(echo "$RESP" | say_of)"
ACTION=$(echo "$RESP" | action_of)

IFS='|' read -ra STEPS <<< "$UTTERANCES"
for U in "${STEPS[@]}"; do
  if [ -z "$ACTION" ]; then
    echo "  (no further gather — call ended)"
    break
  fi
  URL="$SITE_URL$ACTION"
  echo
  echo "→ CALLER says: \"$U\""
  RESP=$(curl -sS -X POST -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "From=$FROM" \
    --data-urlencode "CallSid=CAtest123" \
    --data-urlencode "SpeechResult=$U" \
    "$URL")
  echo "  ROBOT: $(echo "$RESP" | say_of)"
  if echo "$RESP" | grep -q "<Hangup"; then
    echo
    echo "  ✓ Call complete. Check $SITE_URL/app/growth for the logged voice lead."
    ACTION=""
    break
  fi
  ACTION=$(echo "$RESP" | action_of)
done

if [ -n "$ACTION" ]; then
  echo
  echo "  (script exhausted; robot is still waiting at: $ACTION)"
fi
