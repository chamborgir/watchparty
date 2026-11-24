import crypto from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, BUCKET, PUBLIC_URL } from "./_r2.js";

const ROOM_RE = /^[a-z0-9]{4,12}$/;
const REQUIRED = ["S3_ENDPOINT", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_BUCKET", "S3_PUBLIC_URL"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const missing = REQUIRED.filter((k) => !process.env[k]);
    if (missing.length) return res.status(500).json({ error: `Missing env vars: ${missing.join(", ")}` });

    const { roomId, filename, contentType } = req.body || {};
    if (!ROOM_RE.test(roomId || "")) return res.status(400).json({ error: "Bad room" });
    if (!filename) return res.status(400).json({ error: "Missing filename" });

    const safe = filename.replace(/[^\w.\-]+/g, "_").slice(-120);
    const key = `${roomId}/${crypto.randomUUID()}-${safe}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType || "video/mp4",
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 60 * 6 });

    res.status(200).json({ uploadUrl, key, publicUrl: `${PUBLIC_URL}/${key}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "Could not sign upload" });
  }
}