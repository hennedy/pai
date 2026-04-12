import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || '',
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || '',
      },
    })
  }
  return s3Client
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const client = getS3Client()
  const bucket = process.env.CLOUDFLARE_R2_BUCKET || 'pai-storage'

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )

  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
  return `${publicUrl}/${key}`
}
