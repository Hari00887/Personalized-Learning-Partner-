import crypto from "crypto";

export const makeNamespace = (seed) =>
  crypto.createHash("sha1").update(String(seed)).digest("hex").slice(0, 16);