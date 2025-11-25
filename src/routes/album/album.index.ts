import { createRouter } from "@/lib/create-app";
import * as handlers from "./album.handlers";
import * as routes from "./album.routes";

const router = createRouter()
  .openapi(routes.listAlbumsRoute, handlers.listAlbums)
  .openapi(routes.createAlbumRoute, handlers.createAlbum)
  .openapi(routes.generateUploadUrlRoute, handlers.generateUploadUrl);

export default router;
