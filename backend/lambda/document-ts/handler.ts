import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

const s3 = new S3Client({});

export const handler = async (event: any) => {
  try {
    const body = JSON.parse(event.body);

    const { fileBase64, fileName, userId } = body;

    // convert base64 → buffer
    const fileBuffer = Buffer.from(fileBase64, "base64");

    // SHA256 hash
    const hash = crypto.createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    // ===== MOCK BLOCKCHAIN STORE =====
    // Later replace with QLDB
    const blockchainTxId = "tx_" + hash.slice(0, 10);

    // ===== Upload to S3 =====
    await s3.send(new PutObjectCommand({
      Bucket: process.env.DOCUMENT_BUCKET!,
      Key: `${userId}/${fileName}`,
      Body: fileBuffer
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        documentId: fileName,
        hash,
        blockchainTxId
      })
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
