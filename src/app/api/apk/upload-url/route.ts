import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

const MAX_APK_SIZE_BYTES = 120 * 1024 * 1024;

type UploadUrlRequest = {
  fileName?: string;
  contentType?: string;
  size?: number;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const accountId = process.env.R2_ACCOUNT_ID;
    const endpoint =
      process.env.R2_S3_API_URL ||
      process.env.R2_ENDPOINT ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

    if (!endpoint) {
      return NextResponse.json(
        { detail: "Set R2_S3_API_URL or R2_ENDPOINT, or provide R2_ACCOUNT_ID." },
        { status: 500 },
      );
    }

    const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
    const bucket = requiredEnv("R2_BUCKET_NAME");
    const objectKey = process.env.R2_APK_OBJECT_KEY || "apk/bloodlink.apk";
    const expiresRaw = process.env.R2_SIGNED_URL_EXPIRES_SECONDS || "300";
    const expiresInSeconds = Number.parseInt(expiresRaw, 10);

    if (!Number.isFinite(expiresInSeconds) || expiresInSeconds < 60 || expiresInSeconds > 3600) {
      return NextResponse.json(
        { detail: "R2_SIGNED_URL_EXPIRES_SECONDS must be between 60 and 3600." },
        { status: 500 },
      );
    }

    const body = (await req.json()) as UploadUrlRequest;
    const fileName = (body.fileName || "").toLowerCase();
    const contentType = body.contentType || "application/vnd.android.package-archive";
    const size = Number(body.size || 0);

    if (!fileName.endsWith(".apk")) {
      return NextResponse.json({ detail: "Only .apk files are allowed." }, { status: 400 });
    }

    if (!Number.isFinite(size) || size <= 0 || size > MAX_APK_SIZE_BYTES) {
      return NextResponse.json(
        { detail: "APK size must be greater than 0 and up to 120 MB." },
        { status: 400 },
      );
    }

    const client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });

    return NextResponse.json({
      uploadUrl,
      uploadMethod: "PUT",
      requiredContentType: contentType,
      uploadedKey: objectKey,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to create upload URL";
    return NextResponse.json({ detail }, { status: 500 });
  }
}
