import { createBrowserRouter } from "react-router-dom";
import { Home } from "./pages/Home";
import { Category } from "./pages/Category";
import { MediaDetail } from "./pages/MediaDetail";
import { Lists } from "./pages/Lists";
import { ListDetail } from "./pages/ListDetail";
import { Settings } from "./pages/Settings";
import { Diary } from "./pages/Diary";
import { TierListPage } from "./pages/TierListPage";

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/category/:type", element: <Category /> },
  { path: "/media/:id", element: <MediaDetail /> },
  { path: "/lists", element: <Lists /> },
  { path: "/lists/:id", element: <ListDetail /> },
  { path: "/tier-lists/:id", element: <TierListPage /> },
  { path: "/diary", element: <Diary /> },
  { path: "/settings", element: <Settings /> },
]);
