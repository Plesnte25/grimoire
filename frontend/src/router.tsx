import { createBrowserRouter } from "react-router-dom";
import { Home } from "./pages/Home";
import { Category } from "./pages/Category";
import { MediaDetail } from "./pages/MediaDetail";
import { Lists } from "./pages/Lists";
import { ListDetail } from "./pages/ListDetail";
import { Settings } from "./pages/Settings";
import { Diary } from "./pages/Diary";
import { TierListPage } from "./pages/TierListPage";
import { FranchisePage } from "./pages/FranchisePage";
import { CollectionPage } from "./pages/CollectionPage";
import { ContributorPage } from "./pages/ContributorPage";
import { Library } from "./pages/Library";
import { You } from "./pages/You";
import { Stats } from "./pages/Stats";
import { SharedListPage } from "./pages/SharedList";
import { AppShell } from "./components/AppShell";
import { PasscodeGate } from "./components/PasscodeGate";

export const router = createBrowserRouter([
  {
    element: <PasscodeGate />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <Home /> },
          { path: "/library", element: <Library /> },
          { path: "/you", element: <You /> },
          { path: "/stats", element: <Stats /> },
          { path: "/category/:type", element: <Category /> },
          { path: "/region/:key", element: <Category /> },
          { path: "/media/:id", element: <MediaDetail /> },
          { path: "/lists", element: <Lists /> },
          { path: "/lists/:id", element: <ListDetail /> },
          { path: "/tier-lists/:id", element: <TierListPage /> },
          { path: "/diary", element: <Diary /> },
          { path: "/franchise/:id", element: <FranchisePage /> },
          { path: "/collection/:id", element: <CollectionPage /> },
          { path: "/people/:id", element: <ContributorPage /> },
          { path: "/settings", element: <Settings /> },
        ],
      },
    ],
  },
  { path: "/shared/:token", element: <SharedListPage /> },
]);
