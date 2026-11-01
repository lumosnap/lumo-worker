import type { Environment } from "@/env";

export const useBackBlaze = async (env: Environment) => {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

  const s3Client = new S3Client({
    region: env.STORAGE_REGION,
    endpoint: env.STORAGE_API_BASE,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.STORAGE_API_KEY_ID,
      secretAccessKey: env.STORAGE_API_KEY,
    },
  });

  const s3Client2 = new S3Client({
    region: env.STORAGE2_REGION,
    endpoint: env.STORAGE2_API_BASE,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.STORAGE2_API_KEY_ID,
      secretAccessKey: env.STORAGE2_API_KEY,
    },
  });

  const getStorageConfig = (isSecondaryStorage: boolean = false) => {
    if (isSecondaryStorage) {
      return {
        bucketName: env.STORAGE2_BUCKET_NAME,
        publicUrlBase: env.STORAGE2_PUBLIC_URL_BASE,
        s3Client: s3Client2,
      };
    }
    return {
      bucketName: env.STORAGE_BUCKET_NAME,
      publicUrlBase: env.STORAGE_PUBLIC_URL_BASE,
      s3Client: s3Client,
    };
  };

  const getSignedUrls = async (files: Array<{ filename: string }>, albumId: string, isSecondaryStorage: boolean = false) => {
    const config = getStorageConfig(isSecondaryStorage);
    
    const uploadUrls = await Promise.all(
      files.map(async (file) => {
        // Generate key for original image in originals/ subfolder
        const originalKey = `${albumId}/originals/${file.filename}`;
        const originalCommand = new PutObjectCommand({
          Bucket: config.bucketName,
          Key: originalKey,
          StorageClass:'ONEZONE_IA',
          ContentType: 'image/webp',
        });

        const originalUrl = await getSignedUrl(config.s3Client, originalCommand, {
          expiresIn: 3600,
        });

        // Generate key for thumbnail in thumbnails/ subfolder
        const thumbnailKey = `${albumId}/thumbnails/${file.filename}`;
        const thumbnailCommand = new PutObjectCommand({
          Bucket: config.bucketName,
          Key: thumbnailKey,
          ACL:'public-read',
          ContentType: 'image/webp',
        });
        const thumbnailUrl = await getSignedUrl(config.s3Client, thumbnailCommand, {
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

  // Album vector file: content-hash named, so it can be cached forever.
  // Cache-Control and x-amz-acl are signed headers: the PUT must send exactly these.
  const getVectorsUploadUrl = async (albumId: string, hash: string, isSecondaryStorage: boolean = false) => {
    const config = getStorageConfig(isSecondaryStorage);
    const key = `${albumId}/vectors/${hash}.bin`;
    const headers = {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'x-amz-acl': 'public-read',
    };
    const command = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      ACL: 'public-read',
      ContentType: headers['Content-Type'],
      CacheControl: headers['Cache-Control'],
    });
    const url = await getSignedUrl(config.s3Client, command, {
      expiresIn: 3600,
      signableHeaders: new Set(['content-type', 'cache-control']),
      unhoistableHeaders: new Set(['x-amz-acl']),
    });
    return { url, key, headers };
  };

  const getPublicUrl = (key: string, isSecondaryStorage: boolean = false) => {
    const config = getStorageConfig(isSecondaryStorage);
    // publicUrlBase already includes the bucket path segment where the provider
    // needs one (Backblaze path-style); Scaleway is virtual-hosted so it doesn't.
    return `${config.publicUrlBase}/${key}`;
  };

  const deleteFile = async (fileId: string, isSecondaryStorage: boolean = false) => {
    const config = getStorageConfig(isSecondaryStorage);
    const command = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: fileId,
    });
    return await config.s3Client.send(command);
  };

  // false when the object doesn't exist; other errors propagate.
  const fileExists = async (key: string, isSecondaryStorage: boolean = false) => {
    const config = getStorageConfig(isSecondaryStorage);
    const command = new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    });
    try {
      await config.s3Client.send(command);
      return true;
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  };

  return {
    getSignedUrls,
    getVectorsUploadUrl,
    getPublicUrl,
    deleteFile,
    fileExists,
  };
};
