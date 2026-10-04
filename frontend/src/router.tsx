import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, useParams } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { PasscodeGate } from "./components/PasscodeGate";

const Home = lazy(() => import("./pages/Home").then((module) => ({ default: module.Home })));
const MediaDetail = lazy(() => import("./pages/MediaDetail").then((module) => ({ default: module.MediaDetail })));
const Lists = lazy(() => import("./pages/Lists").then((module) => ({ default: module.Lists })));
const ListDetail = lazy(() => import("./pages/ListDetail").then((module) => ({ default: module.ListDetail })));
const Settings = lazy(() => import("./pages/Settings").then((module) => ({ default: module.Settings })));
const TierListPage = lazy(() => import("./pages/TierListPage").then((module) => ({ default: module.TierListPage })));
const FranchisePage = lazy(() => import("./pages/FranchisePage").then((module) => ({ default: module.FranchisePage })));
const ContributorPage = lazy(() => import("./pages/ContributorPage").then((module) => ({ default: module.ContributorPage })));
const Library = lazy(() => import("./pages/Library").then((module) => ({ default: module.Library })));
const You = lazy(() => import("./pages/You").then((module) => ({ default: module.You })));
const SharedListPage = lazy(() => import("./pages/SharedList").then((module) => ({ default: module.SharedListPage })));
const Discover = lazy(() => import("./pages/Discover").then((module) => ({ default: module.Discover })));

function PageLoading() {
  return <div className="mx-auto max-w-[1440px] px-5 py-10 text-sm text-[var(--tx3)]">Opening your library…</div>;
}

function LegacyLibraryRedirect({ isRegion = false }: { isRegion?: boolean }) {
  const { type, key } = useParams();
  const value = isRegion ? "TV" : type?.toUpperCase();
  const valid = ["MOVIE", "TV", "ANIME", "BOOK"].includes(value ?? "");
  const search = new URLSearchParams();
  if (valid) search.set("type", value!);
  if (isRegion && ["TR", "PK", "KR", "EU"].includes(key?.toUpperCase() ?? "")) {
    search.set("type", "TV");
    search.set("region", key!.toUpperCase());
  }
  const query = search.toString();
  return <Navigate to={`/library${query ? `?${query}` : ""}`} replace />;
}

function LegacyCollectionRedirect() {
  const { id } = useParams();
  return <Navigate to={`/franchise/${encodeURIComponent(id ?? "")}?collection=1`} replace />;
}

export const router = createBrowserRouter([
  {
    element: <PasscodeGate />,
    children: [
      {
        element: <Suspense fallback={<PageLoading />}><AppShell /></Suspense>,
        children: [
          { path: "/", element: <Home /> },
          { path: "/library", element: <Library /> },
          { path: "/discover", element: <Discover /> },
          { path: "/you", element: <You /> },
          { path: "/stats", element: <Navigate to="/you" replace /> },
          { path: "/category/:type", element: <LegacyLibraryRedirect /> },
          { path: "/region/:key", element: <LegacyLibraryRedirect isRegion /> },
          { path: "/media/:id", element: <MediaDetail /> },
          { path: "/lists", element: <Lists /> },
          { path: "/lists/:id", element: <ListDetail /> },
          { path: "/tier-lists/:id", element: <TierListPage /> },
          { path: "/franchise/:id", element: <FranchisePage /> },
          { path: "/collection/:id", element: <LegacyCollectionRedirect /> },
          { path: "/people/:id", element: <ContributorPage /> },
          { path: "/settings", element: <Settings /> },
        ],
      },
    ],
  },
  { path: "/diary", element: <Navigate to="/" replace /> },
  { path: "/shared/:token", element: <Suspense fallback={<PageLoading />}><SharedListPage /></Suspense> },
]);
