import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import Room from "./Room";
import "./App.css";

const readCode = () => new URLSearchParams(window.location.search).get("room");

export default function App() {
  const [code, setCode] = useState(readCode());

  useEffect(() => {
    const onPop = () => setCode(readCode());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (next) => {
    const url = next ? `?room=${next}` : window.location.pathname;
    window.history.pushState({}, "", url);
    setCode(next);
  };

  return (
    <div className="app-shell">
      <div className="app-content">
        {code ? (
          <Room key={code} code={code} onLeave={() => navigate(null)} />
        ) : (
          <Dashboard onEnter={navigate} />
        )}
      </div>
      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Made with &lt;3 by</span>{" "}
        <a href="https://rb-dev.vercel.app/" target="_blank" rel="noreferrer">
          chamborgir
        </a>
      </footer>
    </div>
  );
}
