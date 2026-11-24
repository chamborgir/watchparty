import { S3Client } from "@aws-sdk/client-s3";

export const BUCKET = process.env.S3_BUCKET;
export const PUBLIC_URL = (process.env.S3_PUBLIC_URL || "").replace(/\/+$/, "");

export const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  // keeps the signed upload free of extra checksum headers
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});