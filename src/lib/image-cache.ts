import type { Environment } from "@/env";

export const useImageUrlCache = () => {
  const generateImageUrl = async (imageId: string, env: Environment, isSecondaryStorage: boolean = false): Promise<string> => {
    // Public URL format: STORAGE_PUBLIC_URL_BASE/STORAGE_BUCKET_NAME/album_id/original_filename
    const publicUrlBase = isSecondaryStorage ? env.STORAGE2_PUBLIC_URL_BASE : env.STORAGE_PUBLIC_URL_BASE;
    const bucketName = isSecondaryStorage ? env.STORAGE2_BUCKET_NAME : env.STORAGE_BUCKET_NAME;
    return `${publicUrlBase}/${imageId}`;
  };

  const generateThumbnailUrl = async (imageId: string, env: Environment, isSecondaryStorage: boolean = false): Promise<string> => {
    // Thumbnails use the same key structure, prefix is just metadata
    const publicUrlBase = isSecondaryStorage ? env.STORAGE2_PUBLIC_URL_BASE : env.STORAGE_PUBLIC_URL_BASE;
    const bucketName = isSecondaryStorage ? env.STORAGE2_BUCKET_NAME : env.STORAGE_BUCKET_NAME;
    return `${publicUrlBase}/${imageId}`;
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
