const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ProxyMarker = require('../models/ProxyMarker');
const FacultyRequest = require('../models/facultyRequest');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const adminController = require('../controllers/adminController');

// Configure multer for memory storage (for Excel files)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Middleware to ensure admin or faculty role
const ensureAdminOrFaculty = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'faculty')) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin or faculty privileges required.' });
    }
};

// Get suspicious devices from ProxyMarker collection
router.get('/suspicious-devices', auth, ensureAdminOrFaculty, async (req, res) => {
    try {
        // Group by userId and count occurrences
        const suspiciousDevices = await ProxyMarker.aggregate([
            {
                $group: {
                    _id: {
                        userId: "$userId",
                        name: "$name",
                        course: "$course",
                        section: "$section",
                        classRollNumber: "$classRollNumber"
                    },
                    ipAddresses: { $addToSet: "$ipAddress" },
                    countries: { $addToSet: "$country" },
                    lastSeen: { $max: "$timestamp" },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    userId: "$_id.userId",
                    name: "$_id.name",
                    course: "$_id.course",
                    section: "$_id.section",
                    classRollNumber: "$_id.classRollNumber",
                    ipAddresses: 1,
                    countries: 1,
                    lastSeen: 1,
                    count: 1
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.json(suspiciousDevices);
    } catch (error) {
        console.error('Error getting suspicious devices:', error);
        res.status(500).json({ message: 'Server error while fetching suspicious devices' });
    }
});

// Admin login route
router.post('/login', async (req, res) => {
  console.log('Admin login attempt received:', req.body);
  const { adminId, password } = req.body;
  
  // Check if environment variables are set
  if (!process.env.ADMIN_ID || !process.env.ADMIN_PASSWORD) {
    console.error('Admin credentials not configured in environment variables');
    return res.status(500).json({ message: 'Server configuration error' });
  }
  
  console.log('Checking admin credentials...');
  // Hard-coded admin credentials (should be stored in environment variables in production)
  if (adminId === process.env.ADMIN_ID && password === process.env.ADMIN_PASSWORD) {
    console.log('Admin login successful for:', adminId);
    const payload = { id: 'admin', role: 'admin' };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token, user: { role: 'admin' } });
  }
  
  console.log('Admin login failed for:', adminId);
  return res.status(401).json({ message: 'Invalid admin credentials' });
});

// Middleware to ensure admin role
const ensureAdmin = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Get all faculty requests
router.get('/faculty-requests', ensureAdmin, async (req, res) => {
  try {
    const requests = await FacultyRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching faculty requests:', error);
    res.status(500).json({ message: 'Server error while fetching faculty requests' });
  }
});

// Approve faculty request
router.post('/approve-faculty/:requestId', ensureAdmin, async (req, res) => {
  try {
    const request = await FacultyRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ message: 'Faculty request not found' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Request is already ${request.status}` });
    }
    
    // Generate faculty ID (e.g., FAC-[timestamp]-[random])
    const facultyId = `FAC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    
    // Generate random default password
    const defaultPassword = 'quickroll123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    // Create new faculty user
    const newFaculty = new User({
      name: request.name,
      email: request.email,
      password: hashedPassword,
      role: 'faculty',
      facultyId,
      department: request.department,
      sectionsTeaching: request.sectionsTeaching || [], // Add sections teaching from request
      isVerified: true, // Auto-verify faculty accounts
      passwordChangeRequired: true, // Force password change on first login
      // Adding required fields with default values
      studentId: 'N/A',
      course: request.department,
      section: 'Faculty',
      classRollNumber: '00',
      universityRollNumber: 'N/A',
      sectionId: '000000000000000000000000' // Default ObjectId
    });
    
    await newFaculty.save();
    
    // Update request status
    request.status = 'approved';
    await request.save();
    
    // Send email with credentials
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    
    // Format sections teaching for email
    const sectionsHtml = request.sectionsTeaching && request.sectionsTeaching.length > 0 
      ? `<p><strong>Sections You Teach:</strong> ${request.sectionsTeaching.join(', ')}</p>` 
      : '';
      
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: request.email,
      subject: 'Your Faculty Account Credentials',
      html: `
        <h1>Welcome to the Attendance System</h1>
        <p>Dear ${request.name},</p>
        <p>Your faculty account has been approved. Here are your login credentials:</p>
        <p><strong>Faculty ID:</strong> ${facultyId}</p>
        <p><strong>Steps required for login:</strong></p>
        <ol>
          <li>
            Click this link to reset your password directly: 
            <a href="https://quick-roll-test-4zpp.onrender.com/forgot-password">Forgot Password?</a>
          </li>
          <li>Enter your Gmail address (the one you used while submitting the faculty request).</li>
          <li>Enter your Faculty ID (provided in the email above).</li>
          <li>Set your new password.</li>
          <li>Submit the request.</li>
        </ol>
        <p>If successful, you will be redirected to the login page. If not, please cross-verify your Faculty ID and the new password you entered.</p>
        <p>For security reasons, you will be required to change your password for login.</p>
        <p>If you have any questions, please contact the administrator.</p>
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    res.json({ 
      success: true, 
      message: 'Faculty approved and credentials sent',
      faculty: {
        name: newFaculty.name,
        email: newFaculty.email,
        facultyId,
        department: newFaculty.department
      }
    });
  } catch (error) {
    console.error('Error approving faculty request:', error);
    res.status(500).json({ message: 'Server error while approving faculty request' });
  }
});

// Reject faculty request
router.post('/reject-faculty/:requestId', ensureAdmin, async (req, res) => {
  try {
    const request = await FacultyRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ message: 'Faculty request not found' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Request is already ${request.status}` });
    }
    
    request.status = 'rejected';
    await request.save();

    // Send rejection email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: request.email,
      subject: 'Faculty Account Request Status',
      html: `
        <h1>Faculty Request Update</h1>
        <p>Dear ${request.name},</p>
        <p>After careful consideration, we regret to inform you that your request has been <strong>rejected</strong> due to the wrong information provided.</p>
        <p>If you believe this was a mistake or have further questions, please feel free to reach out to the administrator.</p>
        <p>Thank you for your understanding.</p>
        <p>Best regards,<br>QuickRoll Team</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: 'Faculty request rejected and email notification sent' });
  } catch (error) {
    console.error('Error rejecting faculty request:', error);
    res.status(500).json({ message: 'Server error while rejecting faculty request' });
  }
});


// Preview student data from Excel file
router.post('/preview-student-data', ensureAdmin, upload.single('file'), adminController.previewStudentData);

// Upload and process student data from Excel file
router.post('/upload-student-data', ensureAdmin, upload.single('file'), adminController.uploadStudentData);

module.exports = router;