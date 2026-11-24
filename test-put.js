import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { PutObjectCommand, DeleteObjectCommand } =
    await import("@aws-sdk/client-s3");
const { s3, BUCKET } = await import("./api/_r2.js");

const Key = "test/hello.txt";
try {
    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key,
            Body: "hello",
            ContentType: "text/plain",
        }),
    );
    console.log("PUT ok");
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key }));
    console.log("DELETE ok");
} catch (e) {
    console.log(
        "Failed:",
        e.name,
        "|",
        e.message,
        "|",
        e.$metadata?.httpStatusCode,
    );
}
