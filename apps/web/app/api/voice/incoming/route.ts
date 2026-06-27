import "server-only";

import { firstPrompt } from "@/lib/voice/agent";
import {
  readTwilioForm,
  twimlGather,
  twimlResponse,
  validateTwilioSignature,
} from "@/lib/voice/twilio";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Twilio Voice webhook for an INBOUND call (the safe path — the prospect dials
 * us). Greets, then opens the qualify script. Point your Twilio number's
 * "A call comes in" webhook here (POST).
 *
 * Note on ConversationRelay: Twilio's ConversationRelay needs a persistent
 * WebSocket host, which Vercel's serverless runtime can't provide. This
 * `<Gather speech>` + Claude/HTTP loop is the Vercel-native equivalent; to move
 * to ConversationRelay later, host a small WS service and swap this TwiML for a
 * `<Connect><ConversationRelay url="wss://…"/>`.
 */
export async function POST(req: Request) {
  const params = await readTwilioForm(req);
  if (!validateTwilioSignature(req, params, "/api/voice/incoming")) {
    return new Response("invalid signature", { status: 403 });
  }
  // Empty slots to start; the turn handler carries them forward in the URL.
  const action = "/api/voice/turn?s=" + Buffer.from("{}").toString("base64url");
  return twimlResponse(
    twimlGather({
      say: firstPrompt(),
      action,
      reprompt: "Sorry, I didn't catch that. Are you a debt buyer, broker, collection agency, or fund?",
    })
  );
}
