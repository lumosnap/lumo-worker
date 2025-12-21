import type { Environment } from "@/env";

interface CachedUrl {
  url: string;
  expiresAt: number;
}

class ImageUrlCache {
  private cache = new Map<string, CachedUrl>();
  private readonly CACHE_DURATION = 50 * 60 * 1000; // 50 minutes - shorter than signed URL expiry

  getCachedUrl(imageId: string, generateFn: (id: string) => Promise<string>): Promise<string> {
    const cached = this.cache.get(imageId);
    
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.url);
    }
    
    // Generate new URL
    return generateFn(imageId).then((newUrl) => {
      this.cache.set(imageId, {
        url: newUrl,
        expiresAt: Date.now() + this.CACHE_DURATION
      });
      return newUrl;
    });
  }

  clearExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
const imageUrlCache = new ImageUrlCache();

export const useImageUrlCache = () => {
  const generateImageUrl = async (imageId: string, env: Environment): Promise<string> => {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const s3Client = new S3Client({
      region: 'eu-central-003',
      endpoint: 'https://s3.eu-central-003.backblazeb2.com',
      credentials: {
        accessKeyId: env.BACKBLAZE_API_KEY_ID,
        secretAccessKey: env.BACKBLAZE_API_KEY,
      },
    });

    const getSignedImageUrl = async (key: string): Promise<string> => {
      const command = new GetObjectCommand({
        Bucket: env.BACKBLAZE_BUCKET_NAME,
        Key: key,
      });
      
      // Generate signed URL with 1 hour expiry
      const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600, // 1 hour
      });
      
      return signedUrl;
    };

    return imageUrlCache.getCachedUrl(imageId, (id) => getSignedImageUrl(id));
  };

  const generateThumbnailUrl = async (imageId: string, env: Environment): Promise<string> => {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const s3Client = new S3Client({
      region: 'eu-central-003',
      endpoint: 'https://s3.eu-central-003.backblazeb2.com',
      credentials: {
        accessKeyId: env.BACKBLAZE_API_KEY_ID,
        secretAccessKey: env.BACKBLAZE_API_KEY,
      },
    });

    const getSignedThumbnailUrl = async (key: string): Promise<string> => {
      // Remove the 'thumb_' prefix for the actual file key
      const actualKey = key.replace('thumb_', '');
      const command = new GetObjectCommand({
        Bucket: env.BACKBLAZE_BUCKET_NAME,
        Key: actualKey,
      });
      
      // Generate signed URL with 1 hour expiry
      const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600, // 1 hour
      });
      
      return signedUrl;
    };

    return imageUrlCache.getCachedUrl(`thumb_${imageId}`, (id) => getSignedThumbnailUrl(id));
  };

  return {
    generateImageUrl,
    generateThumbnailUrl,
    clearCache: () => imageUrlCache.clear(),
    clearExpired: () => imageUrlCache.clearExpired(),
    getCacheSize: () => imageUrlCache.size(),
  };
};