import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/hanken-grotesk/wght.css";
import "./styles/index.pcss";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./app/queryClient";
import { ToastHost } from "./components/ToastHost";
import { ThemeProvider } from "./app/ThemeProvider";

function RemoveBootSplash() {
  React.useEffect(() => {
    document.getElementById("boot-splash")?.remove();
  }, []);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
        <ToastHost />
        <RemoveBootSplash />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
