import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { config } from '../config/index.js';
import { AppError } from '../middleware/error.middleware.js';
import logger from '../lib/logger.js';

// Initialize S3 client
const s3Client = new S3Client({
  endpoint: config.storage.s3.endpoint,
  region: config.storage.s3.region,
  credentials: {
    accessKeyId: config.storage.s3.accessKey || '',
    secretAccessKey: config.storage.s3.secretKey || '',
  },
  forcePathStyle: true, // Required for MinIO
});

const bucket = config.storage.s3.bucket;
let bucketEnsured = false;

export class StorageService {
  private static async ensureBucketExists(): Promise<void> {
    if (bucketEnsured) return;

    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
      bucketEnsured = true;
      return;
    } catch (error: any) {
      const status = error?.$metadata?.httpStatusCode;
      const code = error?.name || error?.Code;
      const notFound =
        status === 404 ||
        code === 'NotFound' ||
        code === 'NoSuchBucket';

      if (!notFound) {
        logger.error('Error checking bucket:', error);
        throw AppError.internal('Failed to check storage bucket');
      }
    }

    try {
      const params: Record<string, unknown> = { Bucket: bucket };
      if (config.storage.s3.region && config.storage.s3.region !== 'us-east-1') {
        params.CreateBucketConfiguration = { LocationConstraint: config.storage.s3.region };
      }
      await s3Client.send(new CreateBucketCommand(params));
      bucketEnsured = true;
      logger.info(`Created storage bucket: ${bucket}`);
    } catch (error: any) {
      const code = error?.name || error?.Code;
      if (code === 'BucketAlreadyOwnedByYou' || code === 'BucketAlreadyExists') {
        bucketEnsured = true;
        return;
      }
      logger.error('Error creating bucket:', error);
      throw AppError.internal('Failed to create storage bucket');
    }
  }

  /**
   * Upload a file to S3-compatible storage
   */
  static async uploadFile(
    file: Express.Multer.File,
    folder: string = ''
  ): Promise<string> {
    await this.ensureBucketExists();
    // Validate file type
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (!config.storage.allowedFileTypes.includes(ext)) {
      throw AppError.badRequest(
        `File type .${ext} is not allowed. Allowed types: ${config.storage.allowedFileTypes.join(', ')}`
      );
    }

    // Validate file size
    const maxSizeBytes = config.storage.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw AppError.badRequest(
        `File size exceeds maximum allowed size of ${config.storage.maxFileSizeMB}MB`
      );
    }

    // Generate unique file path
    const timestamp = Date.now();
    const uniqueId = uuidv4().slice(0, 8);
    const sanitizedFileName = this.sanitizeFileName(file.originalname);
    const filePath = folder
      ? `${folder}/${timestamp}-${uniqueId}-${sanitizedFileName}`
      : `${timestamp}-${uniqueId}-${sanitizedFileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: filePath,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      await s3Client.send(command);

      logger.info(`File uploaded: ${filePath}`);
      return filePath;
    } catch (error) {
      logger.error('Error uploading file to S3:', error);
      throw AppError.internal('Failed to upload file');
    }
  }

  /**
   * Get a signed URL for file download
   */
  static async getSignedUrl(
    filePath: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      // Check if file exists
      const headCommand = new HeadObjectCommand({
        Bucket: bucket,
        Key: filePath,
      });

      await s3Client.send(headCommand);

      // Generate signed URL
      const getCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: filePath,
      });

      const url = await getSignedUrl(s3Client, getCommand, { expiresIn });
      return url;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        throw AppError.notFound('File');
      }
      logger.error('Error generating signed URL:', error);
      throw AppError.internal('Failed to generate download URL');
    }
  }

  /**
   * Download a file
   */
  static async downloadFile(filePath: string): Promise<{
    buffer: Buffer;
    contentType: string;
    metadata: Record<string, string>;
  }> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: filePath,
      });

      const response = await s3Client.send(command);

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      return {
        buffer,
        contentType: response.ContentType || 'application/octet-stream',
        metadata: response.Metadata || {},
      };
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        throw AppError.notFound('File');
      }
      logger.error('Error downloading file:', error);
      throw AppError.internal('Failed to download file');
    }
  }

  /**
   * Delete a file
   */
  static async deleteFile(filePath: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: filePath,
      });

      await s3Client.send(command);
      logger.info(`File deleted: ${filePath}`);
      return true;
    } catch (error) {
      logger.error('Error deleting file:', error);
      throw AppError.internal('Failed to delete file');
    }
  }

  /**
   * Check if a file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: filePath,
      });

      await s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(filePath: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
    metadata: Record<string, string>;
  }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: filePath,
      });

      const response = await s3Client.send(command);

      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
        metadata: response.Metadata || {},
      };
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        throw AppError.notFound('File');
      }
      throw error;
    }
  }

  /**
   * Copy a file
   */
  static async copyFile(sourcePath: string, destinationPath: string): Promise<string> {
    try {
      // Download source
      const { buffer, contentType } = await this.downloadFile(sourcePath);

      // Upload to destination
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: destinationPath,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          copiedFrom: sourcePath,
          copiedAt: new Date().toISOString(),
        },
      });

      await s3Client.send(command);
      return destinationPath;
    } catch (error) {
      logger.error('Error copying file:', error);
      throw AppError.internal('Failed to copy file');
    }
  }

  /**
   * Sanitize file name
   */
  private static sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 200);
  }

  /**
   * Get allowed file types
   */
  static getAllowedFileTypes(): string[] {
    return config.storage.allowedFileTypes;
  }

  /**
   * Get max file size in bytes
   */
  static getMaxFileSize(): number {
    return config.storage.maxFileSizeMB * 1024 * 1024;
  }

  /**
   * Validate file before upload
   */
  static validateFile(file: Express.Multer.File): void {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);

    if (!config.storage.allowedFileTypes.includes(ext)) {
      throw AppError.badRequest(
        `File type .${ext} is not allowed. Allowed types: ${config.storage.allowedFileTypes.join(', ')}`
      );
    }

    const maxSizeBytes = config.storage.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw AppError.badRequest(
        `File size exceeds maximum allowed size of ${config.storage.maxFileSizeMB}MB`
      );
    }
  }
}
