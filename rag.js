import dotenv from "dotenv";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { RetrievalQAChain } from "langchain/chains";

dotenv.config();

// --- Pinecone ---
const pinecone = new PineconeClient();
await pinecone.init({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
});
const INDEX_NAME = process.env.PINECONE_INDEX || "rag-index";

// --- Embeddings + LLM ---
const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  apiKey: process.env.OPENAI_API_KEY,
});

const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini",
  temperature: 0,
});

// --- Upsert a single document's text ---
export async function upsertText(text, namespace, source = "uploaded.pdf") {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 120,
  });
  const docs = await splitter.splitDocuments([
    new Document({ pageContent: text, metadata: { source } }),
  ]);

  await PineconeStore.fromDocuments(docs, embeddings, {
    pineconeIndex: pinecone.Index(INDEX_NAME),
    namespace,
  });

  return { chunks: docs.length };
}

// --- Query with RetrievalQA ---
export async function queryRAG(query, namespace, k = 5) {
  const store = new PineconeStore(pinecone.Index(INDEX_NAME), embeddings, {
    namespace,
  });
  const chain = RetrievalQAChain.fromLLM(llm, store, {
    returnSourceDocuments: true,
    k,
  });
  const res = await chain.call({ query });

  const sources = (res.sourceDocuments || []).map((d, i) => ({
    i,
    source: d.metadata?.source || "unknown",
    snippet: d.pageContent?.slice(0, 220),
  }));

  return { answer: res.text, sources };