const { upload } = require('../config/cloudinary');

// Middleware for handling Cloudinary uploads
const handleUpload = (req, res, next) => {
  // Use the single upload middleware for the 'photo' field
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ 
        message: 'Error uploading file', 
        error: err.message 
      });
    }
    
    // If no file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        message: 'Please upload a faculty ID card photo' 
      });
    }
    
    // Add the photo URL to the request body
    req.body.photoUrl = req.file.path;
    
    // Handle sectionsTeaching array
    // When using multipart/form-data, arrays come in as multiple fields with the same name
    // We need to convert them to an actual array
    if (req.body.sectionsTeaching) {
      // If it's already an array, keep it as is
      if (!Array.isArray(req.body.sectionsTeaching)) {
        // If it's a single value, convert it to an array
        req.body.sectionsTeaching = [req.body.sectionsTeaching];
      }
    } else {
      req.body.sectionsTeaching = [];
    }
    
    next();
  });
};

module.exports = {
  handleUpload
};