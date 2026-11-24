import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { PutBucketCorsCommand } = await import("@aws-sdk/client-s3");
const { s3, BUCKET } = await import("./api/_r2.js");

const origins = ["http://localhost:5173", ...process.argv.slice(2)];

await s3.send(
    new PutBucketCorsCommand({
        Bucket: BUCKET,
        CORSConfiguration: {
            CORSRules: [
                {
                    AllowedOrigins: origins,
                    AllowedMethods: ["PUT", "GET", "HEAD"],
                    AllowedHeaders: ["*"],
                    MaxAgeSeconds: 3000,
                },
            ],
        },
    }),
);
console.log("CORS set for:", origins.join(", "));
