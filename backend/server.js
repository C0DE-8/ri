require("dotenv").config();

const express = require("express");
const db = require("./db");

const app = express();
const port = Number(process.env.PORT || 5050);

app.use(express.json());

app.get("/health", async (req, res) => {
  if (!hasFullApiKey(process.env.API_KEY)) {
    return res.status(400).json({
      ok: false,
      error:
        "API_KEY must be the full key shown once when generated. The dashboard project list only shows key prefixes."
    });
  }

  try {
    const status = await db.status();
    return res.json({ ok: true, gateway: status });
  } catch (error) {
    return res.status(503).json({ ok: false, error: error.message });
  }
});

app.get("/db/ping", async (req, res) => {
  try {
    const rows = await db.query("SELECT 1 AS ok");
    return res.json({ ok: true, rows });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const server = app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Set PORT to another value.`);
    process.exit(1);
  }

  throw error;
});

function hasFullApiKey(value) {
  return typeof value === "string" && value.startsWith("dbms_") && value.length > 30;
}
