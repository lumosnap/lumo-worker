import type { Environment } from "@/env";

export const useBackBlaze = async (env: Environment) => {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
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
        // Generate key for original image in originals/ subfolder
        const originalKey = `${albumId}/originals/${file.filename}`;
        const originalCommand = new PutObjectCommand({
          Bucket: env.BACKBLAZE_BUCKET_NAME,
          Key: originalKey,
          ContentType: 'image/webp',
        });
        const originalUrl = await getSignedUrl(s3Client, originalCommand, {
          expiresIn: 3600,
        });

        // Generate key for thumbnail in thumbnails/ subfolder
        const thumbnailKey = `${albumId}/thumbnails/${file.filename}`;
        const thumbnailCommand = new PutObjectCommand({
          Bucket: env.BACKBLAZE_BUCKET_NAME,
          Key: thumbnailKey,
          ContentType: 'image/webp',
        });
        const thumbnailUrl = await getSignedUrl(s3Client, thumbnailCommand, {
          expiresIn: 3600,
        });

        return {
          filename: file.filename,
          uploadUrl: originalUrl,
          key: originalKey,
          thumbnailUploadUrl: thumbnailUrl,
          thumbnailKey: thumbnailKey,
        };
      })
    );
    return uploadUrls;
  };

  const getPublicUrl = (key: string, isThumbnail = false) => {
    // Public URL format: BACKBLAZE_PUBLIC_URL_BASE/BACKBLAZE_BUCKET_NAME/album_id/original_filename
    const bucketName = env.BACKBLAZE_BUCKET_NAME;
    return `${env.BACKBLAZE_PUBLIC_URL_BASE}/${bucketName}/${key}`;
  };

  const deleteFile = async (fileId: string) => {
    const command = new DeleteObjectCommand({
      Bucket: env.BACKBLAZE_BUCKET_NAME,
      Key: fileId,
    });
    return await s3Client.send(command);
  };

  return {
    getSignedUrls,
    getPublicUrl,
    deleteFile,
  };
};
