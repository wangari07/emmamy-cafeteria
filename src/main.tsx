import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css"; // keep your global styles import

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConvexProvider>
  </React.StrictMode>
);