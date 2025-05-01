const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { promisify } = require('util');
const mkdirAsync = promisify(fs.mkdir);
const unlinkAsync = promisify(fs.unlink);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

// Configuration
const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH || path.join(__dirname, '../../temp-photos');
const PHOTO_RETENTION_HOURS = process.env.PHOTO_RETENTION_HOURS || 24; // Default 24 hours
const MAX_PHOTO_SIZE_KB = process.env.MAX_PHOTO_SIZE_KB || 500; // Default 500KB after compression

// Ensure the storage directory exists
const initializeStorage = async () => {
  try {
    if (!fs.existsSync(PHOTO_STORAGE_PATH)) {
      await mkdirAsync(PHOTO_STORAGE_PATH, { recursive: true });
      console.log(`Created photo storage directory at ${PHOTO_STORAGE_PATH}`);
    }
    return true;
  } catch (error) {
    console.error('Failed to initialize photo storage directory:', error);
    return false;
  }
};

// Generate a unique filename for the photo
const generatePhotoFilename = (department, semester, section, studentId) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(4).toString('hex');
  return `${department}_${semester}_${section}_${studentId}_${timestamp}_${randomString}.jpg`;
};

// Process and save the photo
const savePhoto = async (photoData, department, semester, section, studentId) => {
  await initializeStorage();
  
  try {
    // Remove the data:image/jpeg;base64, part if present
    const base64Data = photoData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Process the image - resize and compress
    const processedImageBuffer = await sharp(buffer)
      .resize(640, 480, { fit: 'inside' }) // Resize to reasonable dimensions
      .jpeg({ quality: 80 }) // Compress with 80% quality
      .toBuffer();
    
    // Check if the processed image is within size limits
    if (processedImageBuffer.length > MAX_PHOTO_SIZE_KB * 1024) {
      throw new Error(`Photo exceeds maximum size of ${MAX_PHOTO_SIZE_KB}KB after compression`);
    }
    
    // Generate filename and save
    const filename = generatePhotoFilename(department, semester, section, studentId);
    const filePath = path.join(PHOTO_STORAGE_PATH, filename);
    
    await fs.promises.writeFile(filePath, processedImageBuffer);
    console.log(`Saved photo for student ${studentId} at ${filePath}`);
    
    return {
      filename,
      filePath,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error saving photo:', error);
    throw new Error(`Failed to save photo: ${error.message}`);
  }
};

// Get a photo by filename
const getPhoto = async (filename) => {
  try {
    const filePath = path.join(PHOTO_STORAGE_PATH, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error('Photo not found');
    }
    
    return {
      filePath,
      data: await fs.promises.readFile(filePath)
    };
  } catch (error) {
    console.error('Error retrieving photo:', error);
    throw new Error(`Failed to retrieve photo: ${error.message}`);
  }
};

// Delete a specific photo
const deletePhoto = async (filename) => {
  try {
    const filePath = path.join(PHOTO_STORAGE_PATH, filename);
    if (fs.existsSync(filePath)) {
      await unlinkAsync(filePath);
      console.log(`Deleted photo: ${filename}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting photo:', error);
    return false;
  }
};

// Delete all photos for a specific session
const deleteSessionPhotos = async (department, semester, section) => {
  try {
    const sessionPrefix = `${department}_${semester}_${section}_`;
    const files = await readdirAsync(PHOTO_STORAGE_PATH);
    
    let deletedCount = 0;
    for (const file of files) {
      if (file.startsWith(sessionPrefix)) {
        await deletePhoto(file);
        deletedCount++;
      }
    }
    
    console.log(`Deleted ${deletedCount} photos for session ${department}-${semester}-${section}`);
    return deletedCount;
  } catch (error) {
    console.error('Error deleting session photos:', error);
    return 0;
  }
};

// Cleanup old photos based on retention policy
const cleanupOldPhotos = async () => {
  try {
    const files = await readdirAsync(PHOTO_STORAGE_PATH);
    const now = Date.now();
    const retentionMs = PHOTO_RETENTION_HOURS * 60 * 60 * 1000;
    
    let deletedCount = 0;
    for (const file of files) {
      const filePath = path.join(PHOTO_STORAGE_PATH, file);
      const stats = await statAsync(filePath);
      const fileAge = now - stats.mtimeMs;
      
      if (fileAge > retentionMs) {
        await unlinkAsync(filePath);
        deletedCount++;
      }
    }
    
    console.log(`Cleanup: Deleted ${deletedCount} old photos`);
    return deletedCount;
  } catch (error) {
    console.error('Error during photo cleanup:', error);
    return 0;
  }
};

// Verify a photo against a reference photo (if available)
const verifyPhoto = async (photoFilename, referencePhotoUrl = null) => {
  // In a real implementation, this would use facial recognition to compare photos
  // For this implementation, we'll simply verify that the photo exists
  try {
    const filePath = path.join(PHOTO_STORAGE_PATH, photoFilename);
    if (!fs.existsSync(filePath)) {
      return {
        verified: false,
        reason: 'Photo not found'
      };
    }
    
    // For now, we'll consider all photos as verified
    // In a production system, you would implement actual facial recognition here
    return {
      verified: true,
      confidence: 1.0 // Confidence score (1.0 = 100%)
    };
  } catch (error) {
    console.error('Error verifying photo:', error);
    return {
      verified: false,
      reason: error.message || 'Unknown error during verification'
    };
  }
};

// Schedule regular cleanup
const scheduleCleanup = () => {
  // Run cleanup every 6 hours
  const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
  setInterval(cleanupOldPhotos, CLEANUP_INTERVAL_MS);
  console.log('Scheduled regular photo cleanup');
};

// Initialize storage and schedule cleanup on module load
(async () => {
  await initializeStorage();
  scheduleCleanup();
})();

module.exports = {
  savePhoto,
  getPhoto,
  deletePhoto,
  deleteSessionPhotos,
  cleanupOldPhotos,
  verifyPhoto
};
