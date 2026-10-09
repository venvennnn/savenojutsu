import { NextResponse } from "next/server";
import { noStoreHeaders } from "./config.server";

export function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders,
  });
}

export function publicError(status: number, code: string, message: string) {
  return jsonNoStore({ error: { code, message } }, status);
}
