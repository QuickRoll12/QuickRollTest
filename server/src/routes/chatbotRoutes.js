const express = require('express');
const router = express.Router();
const chatbotService = require('../services/chatbotService');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/chatbot');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
    }
  }
});

// Route for chatbot queries
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Generate response
    const response = await chatbotService.generateResponse(query, req.user._id);
    
    return res.json({ response });
  } catch (error) {
    console.error('Chatbot error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate response',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Route to get chat history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const history = await chatbotService.getUserChatHistory(req.user._id);
    return res.json({ history });
  } catch (error) {
    console.error('Failed to fetch chat history:', error);
    return res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Admin routes
const adminRouter = express.Router();

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
};

// Apply admin middleware to all admin routes
adminRouter.use(authMiddleware, isAdmin);

// Get all documents
adminRouter.get('/documents', async (req, res) => {
  try {
    const documents = await chatbotService.getAllDocuments();
    return res.json({ documents });
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    return res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Upload document files
adminRouter.post('/documents/upload', upload.array('documents', 5), async (req, res) => {
  try {
    const { category } = req.body;
    
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const results = [];
    
    for (const file of req.files) {
      const result = await chatbotService.processFileDocument(file, category);
      results.push(result);
    }
    
    return res.json({ success: true, results });
  } catch (error) {
    console.error('Failed to upload documents:', error);
    return res.status(500).json({ error: 'Failed to upload documents' });
  }
});

// Add text content
adminRouter.post('/documents/text', async (req, res) => {
  try {
    const { title, content, category } = req.body;
    
    if (!title || !content || !category) {
      return res.status(400).json({ error: 'Title, content, and category are required' });
    }
    
    const result = await chatbotService.processTextDocument(title, content, category);
    
    return res.json({ success: true, result });
  } catch (error) {
    console.error('Failed to add text content:', error);
    return res.status(500).json({ error: 'Failed to add text content' });
  }
});

// Delete document
adminRouter.delete('/documents/:id', async (req, res) => {
  try {
    const result = await chatbotService.deleteDocument(req.params.id);
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete document:', error);
    return res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Attach admin router
router.use('/admin', adminRouter);

module.exports = router;