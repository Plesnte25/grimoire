import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/hanken-grotesk/wght.css";
import "@fontsource/material-symbols-rounded/latin-400.css";
import "@fontsource-variable/noto-sans-jp/index.css";
import "@fontsource-variable/noto-sans-kr/index.css";
import "@fontsource-variable/noto-sans-sc/index.css";
import "@fontsource/noto-nastaliq-urdu/arabic-400.css";
import "./styles/index.pcss";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./app/queryClient";
import { ToastHost } from "./components/ToastHost";
import { ThemeProvider } from "./app/ThemeProvider";
import { OfflineLogSync } from "./components/OfflineLogSync";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
        <OfflineLogSync />
        <ToastHost />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
