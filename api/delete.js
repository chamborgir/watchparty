import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET } from "./_r2.js";

const KEY_RE = /^[a-z0-9]{4,12}\/[\w.\-]+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { key } = req.body || {};
    if (!KEY_RE.test(key || "")) return res.status(400).json({ error: "Bad key" });

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "Could not delete" });
  }
}
