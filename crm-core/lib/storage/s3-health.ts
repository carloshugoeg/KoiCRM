import { HeadBucketCommand } from "@aws-sdk/client-s3"
import { S3Client } from "@aws-sdk/client-s3"

let _probeClient: S3Client | undefined

function probeClient(): S3Client | null {
  const endpoint = process.env.S3_ENDPOINT
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  const bucket = process.env.S3_BUCKET
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null

  if (!_probeClient) {
    _probeClient = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    })
  }
  return _probeClient
}

/** Lightweight R2/S3 connectivity check for /api/health */
export async function probeStorage(timeoutMs = 5_000): Promise<"ok" | "error" | "skipped"> {
  const bucket = process.env.S3_BUCKET
  const client = probeClient()
  if (!client || !bucket) return "skipped"

  try {
    await Promise.race([
      client.send(new HeadBucketCommand({ Bucket: bucket })),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("storage probe timeout")), timeoutMs),
      ),
    ])
    return "ok"
  } catch {
    return "error"
  }
}
