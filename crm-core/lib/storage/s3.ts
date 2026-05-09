import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function makeClient(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

const BUCKET = () => process.env.S3_BUCKET!;

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
  const signedUrl = await getSignedUrl(makeClient(), command, { expiresIn: 300 });
  const publicUrl = `${process.env.S3_PUBLIC_URL}/${key}`;
  return { signedUrl, publicUrl };
}

export async function deleteObject(key: string): Promise<void> {
  await makeClient().send(
    new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }),
  );
}
