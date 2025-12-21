import { createRouter } from "@/lib/create-app";
import * as handlers from "./public.handlers";
import * as routes from "./public.routes";

const router = createRouter()
  .openapi(routes.getAlbumByTokenRoute, handlers.getAlbumByToken)
  .openapi(routes.getFavoritesRoute, handlers.getFavorites)
  .openapi(routes.createFavoriteRoute, handlers.createFavorite)
  .openapi(routes.deleteFavoriteRoute, handlers.deleteFavorite);

export default router;