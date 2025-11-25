import type { Environment } from "@/env";

export const useBackBlaze = async (env: Environment) => {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

  const s3Client = new S3Client({
    region: 'eu-central-003', // your B2 region
    endpoint: 'https://s3.eu-central-003.backblazeb2.com',
    credentials: {
      accessKeyId: env.BACKBLAZE_API_KEY_ID,
      secretAccessKey: env.BACKBLAZE_API_KEY,
    },
  });

  const getSignedUrls = async (files: Array<{ filename: string }>, albumId: string) => {
    const uploadUrls = await Promise.all(
      files.map(async (file) => {
        const key = `${albumId}/${file.filename}`;
        const command = new PutObjectCommand({
          Bucket: env.BACKBLAZE_BUCKET_NAME,
          Key: key,
          ContentType: 'image/avif', // or image/webp
        });
        const url = await getSignedUrl(s3Client, command, {
          expiresIn: 3600,
        });
        return {
          filename: file.filename,
          uploadUrl: url,
          key: key,
        };
      })
    );
    return uploadUrls;
  };

  return {
    getSignedUrls,
  };
};
