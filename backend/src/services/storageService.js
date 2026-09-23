import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

import s3Client from "../config/s3.js";

const uploadFile = async ({ fileBuffer, contentType, objectKey }) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: objectKey,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  return objectKey;
};

const deleteFile = async ({ objectKey }) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: objectKey,
  });

  await s3Client.send(command);
};

export { uploadFile, deleteFile };
