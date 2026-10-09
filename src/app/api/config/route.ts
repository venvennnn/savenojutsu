import { getPublicConfig } from "@/lib/config.server";
import { jsonNoStore } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return jsonNoStore(getPublicConfig());
}
