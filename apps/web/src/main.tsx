import { MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.tsx";
import { AuthProvider } from "./auth.tsx";
import { ThemeProvider } from "./theme.tsx";
import "./index.css";

// Demo pública (GitHub Pages): sin servidor, la API la contesta el propio navegador.
if (import.meta.env.VITE_DEMO === "1") (await import("./demo/install.ts")).installDemoApi();

// reducedMotion="user": quien pide menos movimiento en su sistema no ve las animaciones.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </MotionConfig>
  </StrictMode>,
);
