import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { GigPredictAIDataProvider } from "./context/GigPredictAIDataContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <GigPredictAIDataProvider>
      <App />
    </GigPredictAIDataProvider>
  </React.StrictMode>
);
