// Local-only API server. Runs the same functions that Vercel serves from /api in production.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const envPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    ".env.local",
);
const result = dotenv.config({ path: envPath });
if (result.error) {
    console.log(
        "Could not read .env.local. Copy .env.example to .env.local and fill it in.",
    );
} else {
    console.log(
        "Loaded variables:",
        Object.keys(result.parsed || {}).join(", "),
    );
}

// dynamic imports so env vars are loaded before the storage client is created
const { default: express } = await import("express");
const { default: sign } = await import("./api/sign-upload.js");
const { default: view } = await import("./api/sign-view.js");
const { default: del } = await import("./api/delete.js");

const app = express();
app.use(express.json());
app.post("/api/sign-upload", (req, res) => sign(req, res));
app.post("/api/sign-view", (req, res) => view(req, res));
app.post("/api/delete", (req, res) => del(req, res));

app.listen(3001, () =>
    console.log("Local API running on http://localhost:3001"),
);
