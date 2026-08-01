import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const PRESIGN_TTL_SECONDS = 300;

let _client: S3Client | undefined;
function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT!,
      // MinIO (local S3-compatible storage) addresses buckets by path, not by subdomain.
      // Left off for R2, which keeps its default virtual-host addressing.
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

const BUCKET = () => process.env.S3_BUCKET!;
const PUBLIC_URL = () => process.env.S3_PUBLIC_URL!.replace(/\/$/, "");

export async function signUploadUrl(
  key: string,
  contentType: string,
  contentLength: number,
): Promise<{ signedUrl: string; publicUrl: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  const signedUrl = await getSignedUrl(getClient(), command, { expiresIn: PRESIGN_TTL_SECONDS });
  const publicUrl = `${PUBLIC_URL()}/${key}`;
  return { signedUrl, publicUrl };
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<{ publicUrl: string }> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return { publicUrl: `${PUBLIC_URL()}/${key}` };
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }),
  );
}

/**
 * Authoritative object size, straight from the storage provider. Never trust a
 * client-declared `size` for quota accounting (FINDING-005) — the client can PUT any number
 * of bytes to a presigned URL regardless of what it later claims in `confirmUpload`.
 * Throws if the object is missing or the provider doesn't return a length.
 */
export async function getObjectSize(key: string): Promise<bigint> {
  const res = await getClient().send(new HeadObjectCommand({ Bucket: BUCKET(), Key: key }));
  if (res.ContentLength == null) throw new Error("head_object_missing_content_length");
  return BigInt(res.ContentLength);
}

export async function getObject(
  key: string,
): Promise<{ body: Buffer; contentType: string }> {
  const res = await getClient().send(
    new GetObjectCommand({ Bucket: BUCKET(), Key: key }),
  );
  if (!res.Body) throw new Error("empty_object");
  const bytes = await res.Body.transformToByteArray();
  return {
    body: Buffer.from(bytes),
    contentType: res.ContentType ?? "application/octet-stream",
  };
}
