import { createBrowserRouter } from "react-router-dom";
import { Home } from "./pages/Home";
import { Category } from "./pages/Category";
import { Anime } from "./pages/Anime";
import { MediaDetail } from "./pages/MediaDetail";
import { Lists } from "./pages/Lists";
import { ListDetail } from "./pages/ListDetail";
import { Settings } from "./pages/Settings";

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/category/:type", element: <Category /> },
  { path: "/anime", element: <Anime /> },
  { path: "/media/:id", element: <MediaDetail /> },
  { path: "/lists", element: <Lists /> },
  { path: "/lists/:id", element: <ListDetail /> },
  { path: "/settings", element: <Settings /> },
]);
