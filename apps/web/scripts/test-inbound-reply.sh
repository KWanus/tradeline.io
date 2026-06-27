#!/usr/bin/env bash
#
# End-to-end test for the inbound-reply loop. POSTs a realistic fake broker
# reply to /api/inbound-reply (as a forwarder would), then reads it back from
# /api/replies so you can watch one flow through:
#
#   inbound email  ->  correlate bankKey  ->  classify  ->  replies.json  ->  inbox
#
# Usage:
#   SITE_URL=https://tradeline.io CRON_SECRET=xxxx ./test-inbound-reply.sh
#   # or for a local dev server:
#   SITE_URL=http://localhost:3000 CRON_SECRET=devsecret ./test-inbound-reply.sh
#
# Optional overrides:
#   FROM   sender (default a broker)         TO     +reply address to correlate
#   SUBJECT / BODY                            (default a "has-tape" style reply)
#
# Requires: a server reachable at SITE_URL with ANTHROPIC_API_KEY (to classify)
# and GITHUB_PAT (to persist) configured. Without GITHUB_PAT the POST returns
# {stored:false} — the classify step still runs so you can see the verdict.

set -euo pipefail

SITE_URL="${SITE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
FROM="${FROM:-Pat Surry <pat@garnetcapital.com>}"
TO="${TO:-WAL+reply@reply.tradeline.io}"
SUBJECT="${SUBJECT:-Re: Q on any WAL paper in your inventory}"
BODY="${BODY:-Hi — good timing. We actually have a small Western Alliance credit-card tape coming next week, roughly \$4M face, fresh charge-offs. Before I send it over, can you share your state license and which servicer you use? Thanks, Pat}"

if [ -z "$CRON_SECRET" ]; then
  echo "ERROR: set CRON_SECRET (the same value configured on the server)." >&2
  exit 1
fi

echo "→ POST $SITE_URL/api/inbound-reply"
echo "  from: $FROM"
echo "  to:   $TO  (correlation tag)"
echo

PAYLOAD=$(cat <<JSON
{
  "from": "$FROM",
  "to": "$TO",
  "subject": "$SUBJECT",
  "text": "$BODY",
  "message_id": "test-$(date +%s)@local"
}
JSON
)

echo "$PAYLOAD" | curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  --data @- \
  "$SITE_URL/api/inbound-reply" | sed 's/^/  /'
echo
echo

echo "→ GET $SITE_URL/api/replies (newest first)"
curl -sS "$SITE_URL/api/replies" \
  | sed 's/^/  /' \
  | head -c 2000
echo
echo
echo "Done. If stored:true, open $SITE_URL/app/inbox/replies to approve the drafted reply."
