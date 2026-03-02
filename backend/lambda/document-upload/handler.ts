import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

const s3 = new S3Client({});

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
};

export const handler = async (event: any) => {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers: CORS_HEADERS, body: "" };
    }

    try {
        const body = JSON.parse(event.body);
        const { fileBase64, fileName, userId } = body;

        if (!fileBase64 || !fileName || !userId) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: "Missing required fields: fileBase64, fileName, userId" }),
            };
        }

        // Convert base64 → buffer
        const fileBuffer = Buffer.from(fileBase64, "base64");

        // ===== SHA-256 HASH =====
        const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

        // ===== MOCK BLOCKCHAIN LEDGER =====
        // Records the document hash as a "transaction" — replace with QLDB for production
        const blockchainTxId = "tx_" + hash.slice(0, 10);
        console.log(`[Blockchain] Anchoring hash ${hash} as transaction ${blockchainTxId}`);

        // ===== UPLOAD TO S3 =====
        await s3.send(
            new PutObjectCommand({
                Bucket: process.env.DOCUMENT_BUCKET!,
                Key: `${userId}/${fileName}`,
                Body: fileBuffer,
                Metadata: {
                    sha256Hash: hash,
                    blockchainTxId,
                    uploadedBy: userId,
                },
            })
        );

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                documentId: fileName,
                hash,
                blockchainTxId,
                message: "Document uploaded and hash anchored to ledger",
            }),
        };
    } catch (err: any) {
        console.error("[DocumentUploadLambda] Error:", err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: err.message }),
        };
    }
};
