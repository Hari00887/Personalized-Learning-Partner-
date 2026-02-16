// backend/index.js
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs/promises";
import pdfParse from "pdf-parse";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { upsertText, queryRAG } from "./src/rag.js";
import { makeNamespace } from "./src/utils.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" },
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" }));
app.use(express.json({ limit: "2mb" }));

// Multer for file uploads
const upload = multer({ dest: "uploads/" });

// Socket.IO
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);
});

// Upload PDF
app.post("/api/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const data = await fs.readFile(req.file.path);
    const parsed = await pdfParse(data);
    const text = parsed.text || "";
    if (!text.trim()) return res.status(400).json({ error: "No text found" });

    const namespace = makeNamespace(req.file.originalname + Date.now());
    const { chunks } = await upsertText(text, namespace, req.file.originalname);

    await fs.unlink(req.file.path).catch(() => {});

    return res.json({ namespace, chunksIndexed: chunks, pdfText: text });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to process PDF" });
  }
});

// Chat with RAG
app.post("/api/chat", async (req, res) => {
  try {
    const { message, namespace } = req.body;
    if (!message || !namespace) {
      return res.status(400).json({ error: "Missing message or namespace" });
    }

    const { answer, sources } = await queryRAG(message, namespace, 5);
    res.json({ response: answer, sources });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Chat failed" });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
