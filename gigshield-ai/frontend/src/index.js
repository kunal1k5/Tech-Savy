import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { GigShieldDataProvider } from "./context/GigShieldDataContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <GigShieldDataProvider>
      <App />
    </GigShieldDataProvider>
  </React.StrictMode>
);
