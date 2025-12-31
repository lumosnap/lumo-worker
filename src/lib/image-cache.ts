import type { Environment } from "@/env";

export const useImageUrlCache = () => {
  const generateImageUrl = async (imageId: string, env: Environment): Promise<string> => {
    // Public URL format: BACKBLAZE_PUBLIC_URL_BASE/BACKBLAZE_BUCKET_NAME/album_id/original_filename
    return `${env.BACKBLAZE_PUBLIC_URL_BASE}/${env.BACKBLAZE_BUCKET_NAME}/${imageId}`;
  };

  const generateThumbnailUrl = async (imageId: string, env: Environment): Promise<string> => {
    // Thumbnails use the same key structure, prefix is just metadata
    return `${env.BACKBLAZE_PUBLIC_URL_BASE}/${env.BACKBLAZE_BUCKET_NAME}/${imageId}`;
  };

  return {
    generateImageUrl,
    generateThumbnailUrl,
    clearCache: () => {
      // No-op - public URLs don't need caching
    },
    clearExpired: () => {
      // No-op - public URLs don't expire
    },
    getCacheSize: () => 0, // No caching with public URLs
  };
};