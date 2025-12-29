import { createRouter } from "@/lib/create-app";
import * as handlers from "./public.handlers";
import * as routes from "./public.routes";

const router = createRouter()
  .openapi(routes.getAlbumByTokenRoute, handlers.getAlbumByToken)
  .openapi(routes.getFavoriteImagesRoute, handlers.getFavoriteImages)
  .openapi(routes.createFavoriteRoute, handlers.createFavorite)
  .openapi(routes.deleteFavoriteRoute, handlers.deleteFavorite)
  .openapi(routes.updateNotesRoute, handlers.updateNotes);

export default router;