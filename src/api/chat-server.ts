import express from "express";

import { loadDotEnv } from "../infra/dotenv.js";
import { normalizeEnv } from "../infra/env.js";
import { getReplyFromConfig } from "../auto-reply/reply.js";

loadDotEnv({ quiet: true });
normalizeEnv();

const PORT = Number(process.env.PORT || "3000");

// Optional security (recommended)
const API_KEY = (process.env.CLAWDBOT_API_KEY || "").trim();

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

function toPlainText(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m?.content?.trim())
    .map((m) => {
      if (m.role === "system") return `System: ${m.content.trim()}`;
      if (m.role === "assistant") return `Assistant: ${m.content.trim()}`;
      return `User: ${m.content.trim()}`;
    })
    .join("\n");
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/chat", async (req, res) => {
  try {
    // ---- API key protection (optional) ----
    if (API_KEY) {
      const got =
        String(req.headers["x-api-key"] || "").trim() ||
        String(req.headers["authorization"] || "")
          .replace(/^Bearer\s+/i, "")
          .trim();

      if (!got || got !== API_KEY) {
        return res.status(401).json({ ok: false, error: "unauthorized" });
      }
    }

    const { session_key, user_id, chat_id, text, messages, provider, surface } = req.body || {};

    const sessionKey =
      String(session_key || "").trim() ||
      `api:${String(provider || "telegram")}:${String(chat_id || user_id || "unknown")}`;

    const userText = String(text || "").trim();

    let bodyForAgent = "";
    if (Array.isArray(messages) && messages.length > 0) {
      bodyForAgent = toPlainText(messages as ChatMessage[]);
      if (userText && !bodyForAgent.includes(`User: ${userText}`)) {
        bodyForAgent += (bodyForAgent ? "\n" : "") + `User: ${userText}`;
      }
    } else {
      bodyForAgent = userText;
    }

    if (!bodyForAgent.trim()) {
      return res.status(400).json({ ok: false, error: "missing text/messages" });
    }

    const ctx = {
      Body: bodyForAgent,
      BodyForAgent: bodyForAgent,
      RawBody: userText || bodyForAgent,
      CommandBody: userText || bodyForAgent,

      SessionKey: sessionKey,
      From: String(user_id || "api-user"),
      To: String(chat_id || "api-chat"),

      Provider: String(provider || "telegram"),
      Surface: String(surface || "api"),
      Timestamp: Date.now(),
      CommandAuthorized: false,
      CommandSource: "text" as const,
    };

    const reply = await getReplyFromConfig(ctx);

    const texts: string[] = [];
    const pushText = (t?: string) => {
      if (t && String(t).trim()) texts.push(String(t).trim());
    };

    if (Array.isArray(reply)) {
      for (const r of reply) pushText(r?.text);
    } else {
      pushText(reply?.text);
    }

    res.json({ ok: true, session_key: sessionKey, text: texts.join("\n\n").trim() || "…" });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[clawdbot-api] listening on http://0.0.0.0:${PORT}`);
});
