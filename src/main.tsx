import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (import.meta.env.DEV) {
	console.info("[APP_DEBUG] boot", {
		time: new Date().toISOString(),
		href: window.location.href,
	});

	window.addEventListener("error", (event) => {
		console.error("[APP_DEBUG] window.error", {
			message: event.message,
			file: event.filename,
			line: event.lineno,
			column: event.colno,
			error: event.error,
		});
	});

	window.addEventListener("unhandledrejection", (event) => {
		console.error("[APP_DEBUG] unhandledrejection", event.reason);
	});
}

createRoot(document.getElementById("root")!).render(<App />);
