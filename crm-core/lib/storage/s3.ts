import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const PRESIGN_TTL_SECONDS = 300;

let _client: S3Client | undefined;
function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT!,
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

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }),
  );
}
