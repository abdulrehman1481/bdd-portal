import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function normalizeCredential(value: string): string {
  return value.replace(/\r?\n/g, "").trim();
}

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="BloodLink APK Upload", charset="UTF-8"',
    },
  });
}

function forbiddenResponse(message: string): NextResponse {
  return NextResponse.json({ detail: message }, { status: 403 });
}

export function middleware(req: NextRequest): NextResponse {
  const expectedUserRaw = process.env.APK_UPLOAD_USER;
  const expectedPassRaw = process.env.APK_UPLOAD_PASS;

  if (!expectedUserRaw || !expectedPassRaw) {
    return forbiddenResponse("APK upload credentials are not configured.");
  }

  const expectedUser = normalizeCredential(expectedUserRaw);
  const expectedPass = normalizeCredential(expectedPassRaw);

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  const encoded = authHeader.slice(6).trim();
  let decoded = "";

  try {
    decoded = atob(encoded);
  } catch {
    return unauthorizedResponse();
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) {
    return unauthorizedResponse();
  }

  const user = normalizeCredential(decoded.slice(0, separatorIndex));
  const pass = normalizeCredential(decoded.slice(separatorIndex + 1));

  if (user !== expectedUser || pass !== expectedPass) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/internal/apk-upload/:path*", "/api/apk/upload-url/:path*"],
};
