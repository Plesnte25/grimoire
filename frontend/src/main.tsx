import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.pcss";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./app/queryClient";
import { PasscodeGate } from "./components/PasscodeGate";
import { ToastHost } from "./components/ToastHost";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PasscodeGate>
        <RouterProvider router={router} />
        <ToastHost />
      </PasscodeGate>
    </QueryClientProvider>
  </React.StrictMode>
);
