export const dynamic = "force-static";
export const revalidate = 86400;

/**
 * RFC 9116 security.txt — gives security researchers a documented way to
 * reach a human before they consider going public with a vuln.
 *
 * Expires 1 year out from build time; rebuild whenever you update contact info.
 */
export function GET() {
  const expires = new Date();
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);

  const body = [
    "Contact: mailto:hello@tradeline.io",
    "Contact: mailto:kwanusmrket@gmail.com",
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
    "Preferred-Languages: en",
    "Canonical: https://tradeline.io/.well-known/security.txt",
    "Policy: https://tradeline.io/terms",
    "",
    "# Tradeline is a small operation. Please disclose responsibly:",
    "# - Tell us first by email; give us 30 days to fix before going public.",
    "# - Don't pull data from /app/* or /api/* using credentials you don't own.",
    "# - Don't exfiltrate subscriber data from data/output/ — that's a bright line.",
    "# - We don't have a bug bounty yet. We do read every report and reply.",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
