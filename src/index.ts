import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || "3000");
const API_KEY = (process.env.CLAWDBOT_API_KEY || "").trim();

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    // Optional security
    if (API_KEY) {
      const got =
        String(req.headers["x-api-key"] || "").trim() ||
        String(req.headers["authorization"] || "").replace(/^Bearer\s+/i, "").trim();

      if (!got || got !== API_KEY) {
        return res.status(401).json({ ok: false, error: "unauthorized" });
      }
    }

    const { text, messages } = req.body || {};

    // Basic input
    let prompt = "";
    if (Array.isArray(messages) && messages.length > 0) {
      prompt = messages.map((m: any) => `${m.role}: ${m.content}`).join("\n");
    } else if (typeof text === "string") {
      prompt = text;
    }

    if (!prompt.trim()) {
      return res.status(400).json({ ok: false, error: "missing text/messages" });
    }

    // ✅ THIS IS WHERE YOUR "BRAIN" GOES
    // Right now it just echoes so we can test wiring first.
    // After it's working, we replace this with real Clawdbot logic or an AI provider call.
    const answer = `Brain received: ${prompt}`;

    return res.json({ ok: true, text: answer });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[brain] listening on 0.0.0.0:${PORT}`);
});
