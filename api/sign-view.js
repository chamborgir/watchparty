import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, BUCKET } from "./_r2.js";

const KEY_RE = /^[a-z0-9]{4,12}\/[\w.\-]+$/;

export default async function handler(req, res) {
    if (req.method !== "POST")
        return res.status(405).json({ error: "Method not allowed" });

    try {
        const { key } = req.body || {};
        if (!KEY_RE.test(key || ""))
            return res.status(400).json({ error: "Bad key" });

        const url = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: BUCKET, Key: key }),
            {
                expiresIn: 60 * 60 * 12,
            },
        );
        res.status(200).json({ url });
    } catch (e) {
        console.error(e);
        res.status(500).json({
            error: e.message || "Could not sign view link",
        });
    }
}
