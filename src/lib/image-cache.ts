import type { Environment } from "@/env";

export const useImageUrlCache = () => {
  const generateImageUrl = async (imageId: string, env: Environment, isSecondaryStorage: boolean = false): Promise<string> => {
    const publicUrlBase = isSecondaryStorage ? env.STORAGE2_PUBLIC_URL_BASE : env.STORAGE_PUBLIC_URL_BASE;
    return `${publicUrlBase}/${imageId}`;
  };

  const generateThumbnailUrl = async (imageId: string, env: Environment, isSecondaryStorage: boolean = false): Promise<string> => {
    const publicUrlBase = isSecondaryStorage ? env.STORAGE2_PUBLIC_URL_BASE : env.STORAGE_PUBLIC_URL_BASE;
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
