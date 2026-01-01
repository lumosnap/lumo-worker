import { createRouter } from "@/lib/create-app";
import * as handlers from "./album.handlers";
import * as routes from "./album.routes";

const router = createRouter()
  .openapi(routes.createShareLinkRoute, handlers.createShareLink)
  .openapi(routes.listAlbumsRoute, handlers.listAlbums)
  .openapi(routes.createAlbumRoute, handlers.createAlbum)
  .openapi(routes.generateUploadUrlRoute, handlers.generateUploadUrl)
  .openapi(routes.confirmUploadRoute, handlers.confirmUpload)
  .openapi(routes.updateImagesRoute, handlers.updateImages)
  .openapi(routes.getAlbumImagesRoute, handlers.getAlbumImages)
  .openapi(routes.deleteImageRoute, handlers.deleteImage)
  .openapi(routes.bulkDeleteImagesRoute, handlers.bulkDeleteImages)
  .openapi(routes.getAlbumFavoritesRoute, handlers.getAlbumFavorites)
  .openapi(routes.deleteAlbumRoute, handlers.deleteAlbum);

export default router;
