import React from "react";
import ReactDom from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

ReactDom.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
