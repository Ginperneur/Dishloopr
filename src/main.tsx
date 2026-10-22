import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeCookieAnalytics } from "./lib/cookieConsent";

initializeCookieAnalytics(import.meta.env.VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID);
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
