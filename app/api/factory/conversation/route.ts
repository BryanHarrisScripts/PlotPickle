import { authorizeLocalFactoryRequest as authorize } from "../../../../core/auth/profile-experience/local-factory-request";
import { dispatchConversationRequest } from "../../../../scripts/engineering-team/gateway/conversation-http.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return dispatchConversationRequest({ request, authorize });
}
export async function POST(request: Request) {
  return dispatchConversationRequest({ request, authorize });
}
