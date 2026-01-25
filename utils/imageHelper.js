// utils/imageHelper.js
// Helper functions for image operations with Supabase Storage

import { supabaseAdmin } from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import logger from './logger.js';

// Allow bucket name to be configured via environment variable
const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'pikartas-bucket';

/**
 * Ensure bucket exists, create if it doesn't
 * @returns {Promise<void>}
 */
const ensureBucketExists = async () => {
  try {
    // Check if bucket exists by trying to list buckets
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      logger.error('Error listing buckets:', { message: listError.message });
      // If we can't list buckets, try to create anyway
    } else {
      const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
      if (bucketExists) {
        logger.info(`Bucket '${BUCKET_NAME}' exists`);
        return;
      }
    }

    // Bucket doesn't exist, try to create it
    logger.info(`Bucket '${BUCKET_NAME}' no existe. Intentando crearlo...`);
    
    const { data: newBucket, error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      fileSizeLimit: 5242880 // 5MB
    });

    if (createError) {
      logger.error('Error creando bucket:', { message: createError.message });
      // Don't throw here, let the upload attempt happen and provide clearer error
      throw new Error(
        `El bucket '${BUCKET_NAME}' no existe y no se pudo crear automáticamente. ` +
        `Por favor, créalo manualmente en Supabase Storage: ` +
        `Storage → New bucket → Nombre: '${BUCKET_NAME}' → Public: Sí. ` +
        `Error: ${createError.message}`
      );
    }

    logger.info(`Bucket '${BUCKET_NAME}' creado exitosamente`);
  } catch (error) {
    logger.error('Error en ensureBucketExists:', { message: error.message });
    throw error;
  }
};

/**
 * Upload an image to Supabase Storage
 * @param {object} file - Multer file object
 * @returns {Promise<string>} - Public URL of the uploaded image
 * @throws {Error} - If upload fails
 */
export const uploadImage = async (file) => {
  const fileName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
  const filePath = fileName;

  try {
    // Validate that supabaseAdmin is available
    if (!supabaseAdmin) {
      logger.error('supabaseAdmin is not available - SUPABASE_SERVICE_ROLE_KEY may not be configured');
      throw new Error('Service role key not configured. Image upload is disabled.');
    }
    
    // Ensure bucket exists before uploading
    try {
      await ensureBucketExists();
    } catch (bucketError) {
      // If bucket creation fails, provide helpful error message
      if (bucketError.message && bucketError.message.includes('no existe')) {
        throw bucketError;
      }
      // Otherwise, log and continue - maybe bucket exists but we couldn't verify
      logger.warn('Could not verify/create bucket, attempting upload anyway:', { message: bucketError.message });
    }
    
    // Upload file to Supabase Storage (admin operation - uses service role key)
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      // Provide more helpful error message for bucket not found
      if (error.message && (error.message.includes('Bucket not found') || error.message.includes('not found'))) {
        throw new Error(
          `El bucket '${BUCKET_NAME}' no existe en Supabase Storage. ` +
          `Por favor, créalo manualmente en el panel de Supabase: ` +
          `Storage → New bucket → Nombre: '${BUCKET_NAME}' → Public: Sí`
        );
      }
      throw new Error(`Error subiendo imagen: ${error.message}`);
    }

    // Get public URL
    const { data: publicData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);
    
    return publicData.publicUrl;
    
  } catch (error) {
    logger.error('Error en uploadImage:', { message: error.message });
    throw error;
  }
};

/**
 * Delete an image from Supabase Storage
 * @param {string} imageUrl - Public URL of the image to delete
 * @returns {Promise<void>}
 */
export const deleteImage = async (imageUrl) => {
  try {
    // Validate that supabaseAdmin is available
    if (!supabaseAdmin) {
      logger.error('supabaseAdmin is not available - SUPABASE_SERVICE_ROLE_KEY may not be configured');
      throw new Error('Service role key not configured. Image deletion is disabled.');
    }
    
    // Extract file path from URL
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];
    
    // Delete file from Supabase Storage (admin operation - uses service role key)
    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([fileName]);

    if (error) {
      logger.error('Error eliminando imagen:', { message: error.message });
      throw error;
    }
    
  } catch (error) {
    logger.error('Error eliminando imagen:', { message: error.message });
    throw error;
  }
};
