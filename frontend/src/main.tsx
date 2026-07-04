import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// StrictMode intentionally omitted: the 3D graph (WebGL) double-mounts under it.
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
