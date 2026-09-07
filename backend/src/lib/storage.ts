import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

// R2 is S3-compatible, so the AWS SDK works against it unmodified — only the
// endpoint differs. The bucket is expected to have public read access (a
// checkbox in the Cloudflare dashboard) so attachments can be fetched by
// plain URL without the backend proxying every download.
function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  const publicUrl = process.env.R2_PUBLIC_URL?.trim()?.replace(/\/$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
}

export function storageConfigured(): boolean {
  return Boolean(r2Config());
}

function client(config: NonNullable<ReturnType<typeof r2Config>>) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
}

// Returns a short-lived URL the client uploads the file bytes to directly
// (PUT), keeping large files off our own server's bandwidth entirely.
export async function createUploadUrl(userId: string, filename: string, contentType: string) {
  const config = r2Config();
  if (!config) throw new Error("File uploads are not configured on the server.");

  const safeExt = /\.[a-zA-Z0-9]{1,10}$/.exec(filename)?.[0] ?? "";
  const key = `uploads/${userId}/${randomUUID()}${safeExt}`;
  const command = new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(client(config), command, { expiresIn: 300 });

  return { uploadUrl, publicUrl: `${config.publicUrl}/${key}` };
}
