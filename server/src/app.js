const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const attendanceService = require('./services/attendanceService');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
require('dotenv').config();
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const reportRoutes = require('./routes/reportRoutes');
const sheetMappingRoutes = require('./routes/sheetMappingRoutes');
const attendanceRecordRoutes = require('./routes/attendanceRecordRoutes');
const photoVerificationRoutes = require('./routes/photoVerificationRoutes');
const path = require('path');
const photoVerificationService = require('./services/photoVerificationService'); // Import photoVerificationService

const app = express();
const server = http.createServer(app);

// Production security enhancements
app.set('trust proxy', 1);
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:3000"],
            imgSrc: ["'self'", "data:", "blob:"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        },
    },
}));

// Configure CORS with proper origin
const corsOptions = {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Add custom middleware to ensure proper JSON responses
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function(body) {
        res.setHeader('Content-Type', 'application/json');
        return originalJson.call(this, body);
    };
    next();
});

const io = new Server(server, {
    cors: corsOptions
});

// Sample course data (you can replace this with database queries)
const courses = [
    { id: 'CSE101', name: 'Introduction to Programming' },
    { id: 'CSE201', name: 'Data Structures' },
    { id: 'CSE301', name: 'Database Management' },
    { id: 'CSE401', name: 'Software Engineering' },
    // Add your courses here
    { id: 'ECE101', name: 'Basic Electronics' },
    { id: 'MECH101', name: 'Engineering Mechanics' },
    { id: 'CIVIL101', name: 'Structural Engineering' }
];

const sections = ['A', 'B', 'C', 'D', 'E', 'F'];

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve the temp-photos directory for photo access
app.use('/temp-photos', express.static(path.join(__dirname, '../temp-photos')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', facultyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sheet-mappings', sheetMappingRoutes);
app.use('/api/attendance', attendanceRecordRoutes);
app.use('/api/photo-verification', photoVerificationRoutes);

// MongoDB connection with proper options
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// API routes for course and section data
app.get('/api/courses', (req, res) => {
    res.json(courses);
});

app.get('/api/sections', (req, res) => {
    res.json(sections);
});

// Socket.IO Connection Handling with JWT Authentication
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication token is required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            return next(new Error('User not found'));
        }

        // Attach user to socket for later use
        socket.user = user;
        next();
    } catch (error) {
        next(new Error('Invalid authentication token'));
    }
});

io.on('connection', (socket) => {
    console.log('👤 User connected:', socket.user.name);

    // Send available courses and sections to client
    socket.emit('courseData', { courses, sections });
    
    // Handle explicit request for course data
    socket.on('getCourseData', () => {
        console.log('Sending course data to client');
        socket.emit('courseData', { courses, sections });
    });

    socket.on('getSessionStatus', ({ department, semester, section }) => {
        console.log(`📊 Getting session status - Department: ${department}, Semester: ${semester}, Section: ${section}`);
        
        try {
            const status = attendanceService.getSessionStatus(department, semester, section);
            socket.emit('sessionStatus', {
                active: status.active,
                grid: status.grid,
                department: status.department,
                semester: status.semester,
                section: status.section,
                totalStudents: status.totalStudents,
                photoVerificationRequired: true // Always require photo verification
            });
        } catch (error) {
            console.error('Error getting session status:', error.message);
            socket.emit('error', { message: error.message });
        }
    });

    // New event for photo upload
    socket.on('uploadAttendancePhoto', async ({ department, semester, section, photoData }) => {
        console.log(`📸 Photo upload attempt - Department: ${department}, Semester: ${semester}, Section: ${section}`);
        
        try {
            // Only students can upload photos
            if (socket.user.role !== 'student') {
                throw new Error('Only students can upload attendance photos');
            }
            
            // Verify that the department and section match the user's data
            if (department !== socket.user.course) {
                throw new Error('Department does not match your profile');
            }

            if (section !== socket.user.section) {
                throw new Error('Section does not match your profile');
            }
            
            // Get student ID and roll number
            const studentId = socket.user._id;
            const rollNumber = socket.user.classRollNumber;
            
            // Save the photo
            const photoInfo = await photoVerificationService.savePhoto(
                photoData,
                department,
                semester,
                section,
                rollNumber || studentId
            );
            
            // Send success response
            socket.emit('photoUploadResponse', {
                success: true,
                message: 'Photo uploaded successfully',
                photoInfo: {
                    filename: photoInfo.filename,
                    cloudinaryUrl: photoInfo.cloudinaryUrl,
                    timestamp: photoInfo.timestamp
                }
            });
            
        } catch (error) {
            console.error('Error uploading photo:', error.message);
            socket.emit('photoUploadResponse', {
                success: false,
                message: error.message
            });
        }
    });

    socket.on('startSession', async ({ department, semester, section, totalStudents, sessionType }) => {
        console.log(`📝 Starting session - Department: ${department}, Semester: ${semester}, Section: ${section}, Session Type: ${sessionType || 'roll-based'}, Total Students: ${totalStudents}`);
        
        try {
            // Only faculty can start sessions
            if (socket.user.role !== 'faculty') {
                throw new Error('Only faculty members can start attendance sessions');
            }

            // For roll-based sessions, totalStudents is required
            if (sessionType !== 'gmail' && (!totalStudents || isNaN(totalStudents) || totalStudents < 1)) {
                throw new Error('Please specify a valid number of students');
            }

            const result = await attendanceService.startSession(department, semester, section, parseInt(totalStudents || 0), sessionType);
            // Notify all clients about the new session
            io.emit('sessionStatus', {
                active: true,
                grid: result.grid,
                department,
                semester,
                section,
                totalStudents: result.totalStudents,
                sessionType: result.sessionType
            });
        } catch (error) {
            console.error('Error starting session:', error.message);
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('markAttendance', async (data) => {
        // Determine if this is a roll-based or Gmail-based attendance
        const sessionStatus = attendanceService.getSessionStatus(data.department, data.semester, data.section);
        const isGmailSession = sessionStatus.sessionType === 'gmail';
        
        if (isGmailSession) {
            console.log(`📝 Gmail attendance mark attempt - Department: ${data.department}, Semester: ${data.semester}, Section: ${data.section}, Gmail: ${data.gmail}`);
        } else {
            console.log(`📝 Roll attendance mark attempt - Department: ${data.department}, Semester: ${data.semester}, Section: ${data.section}, Roll: ${data.rollNumber}`);
        }
        
        // Get client IP address - try different socket properties for IP
        let ipAddress = socket.handshake.headers['x-forwarded-for'] || 
                       socket.handshake.headers['x-real-ip'] ||
                       socket.handshake.address;
                       
        // If IP is IPv6 localhost, convert to IPv4
        if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
            ipAddress = '127.0.0.1';
        }
        
        // Remove IPv6 prefix if present
        ipAddress = ipAddress.replace(/^::ffff:/, '');
        
        try {
            // Only students can mark attendance
            if (socket.user.role !== 'student') {
                throw new Error('Only students can mark attendance');
            }

            // For roll-based sessions, verify roll number
            if (!isGmailSession && data.rollNumber !== socket.user.classRollNumber) {
                throw new Error('Roll number does not match your profile');
            }
            
            // For Gmail-based sessions, use the user's email from their profile if not provided
            let gmail = data.gmail;
            if (isGmailSession) {
                if (!gmail || gmail.trim() === '') {
                    // If no email provided, use the one from the user's profile
                    gmail = socket.user.email;
                    console.log(`Using email from user profile: ${gmail}`);
                }
            }

            // Verify that the department and section match the user's data
            if (data.department !== socket.user.course) {
                throw new Error('Department does not match your profile');
            }

            if (data.section !== socket.user.section) {
                throw new Error('Section does not match your profile');
            }
            
            // Check if photo verification is required and a photo was provided
            if (sessionStatus.photoVerificationRequired && !data.photoFilename) {
                throw new Error('Photo verification is required for this session');
            }

            const result = await attendanceService.markAttendance(
                data.department,
                data.semester,
                data.section,
                data.rollNumber,
                data.code,
                data.fingerprint,
                data.webRTCIPs,
                socket.user._id,
                { 
                    ip: ipAddress,
                    userName: socket.user.name,
                    userAgent: socket.handshake.headers['user-agent'] || 'Unknown'
                },
                gmail, // Pass the gmail parameter explicitly
                data.photoFilename, // Pass the photo filename
                data.photoCloudinaryUrl // Pass the Cloudinary URL
            );
            
            socket.emit('attendanceResponse', {
                success: result.success,
                message: result.message,
                photoVerified: !!data.photoFilename
            });

            if (result.success) {
                io.emit('updateGrid', {
                    grid: result.grid,
                    department: data.department,
                    semester: data.semester,
                    section: data.section
                });
            }
        } catch (error) {
            console.error('Error marking attendance:', error.message);
            socket.emit('attendanceResponse', {
                success: false,
                message: error.message
            });
        }
    });

    socket.on('endSession', async ({ department, semester, section }) => {
        console.log(`🛑 Ending session - Department: ${department}, Semester: ${semester}, Section: ${section}`);
        
        try {
            // Only faculty can end sessions
            if (socket.user.role !== 'faculty') {
                throw new Error('Only faculty members can end attendance sessions');
            }

            const result = await attendanceService.endSession(department, semester, section);
            
            // Clean up temporary photos for this session
            try {
                console.log(`Starting photo cleanup for session ${department}-${semester}-${section}`);
                const deletedCount = await photoVerificationService.deleteSessionPhotos(
                    department,
                    semester,
                    section
                );
                console.log(`Cleaned up ${deletedCount} photos for session ${department}-${semester}-${section}`);
            } catch (photoError) {
                console.error('Error cleaning up session photos:', photoError.message);
                // Continue with session end even if photo cleanup fails
            }
            
            // If this was a Gmail-based session, update the Google Sheet
            if (result.sessionType === 'gmail') {
                try {
                    const { updateAttendanceSheet } = require('./services/googleSheetsService');
                    
                    // Create attendance data map for Google Sheets
                    const attendanceData = {};
                    
                    // Set all students as absent (0) by default
                    if (result.allEmails && result.allEmails.length > 0) {
                        result.allEmails.forEach(email => {
                            if (email && email.trim() !== '') {
                                attendanceData[email] = '0';
                            }
                        });
                    }
                    
                    // Set present students to 1
                    if (result.presentStudents && result.presentStudents.length > 0) {
                        result.presentStudents.forEach(email => {
                            if (email && email.trim() !== '') {
                                attendanceData[email] = '1';
                                console.log(`Marking ${email} as present in Google Sheet`);
                            }
                        });
                    }
                    
                    // Only update if we have attendance data
                    if (Object.keys(attendanceData).length > 0) {
                        // Update Google Sheet
                        await updateAttendanceSheet(department, semester, section, attendanceData);
                        console.log('Google Sheet updated successfully');
                    } else {
                        console.warn('No attendance data to update in Google Sheet');
                    }
                } catch (sheetError) {
                    console.error('Error updating Google Sheet:', sheetError);
                    socket.emit('error', { message: 'Session ended but failed to update Google Sheet: ' + sheetError.message });
                }
            }
            
            // Notify all clients about the session ending
            io.emit('sessionEnded', {
                success: true,
                department,
                semester,
                section,
                totalStudents: result.totalStudents,
                presentCount: result.presentCount,
                absentees: result.absentees,
                presentStudents: result.presentStudents,
                sessionType: result.sessionType
            });
        } catch (error) {
            console.error('Error ending session:', error.message);
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('refreshCodes', ({ department, semester, section }) => {
        console.log(`🔄 Refreshing codes - Department: ${department}, Semester: ${semester}, Section: ${section}`);
        
        try {
            // Only faculty can refresh codes
            if (socket.user.role !== 'faculty') {
                throw new Error('Only faculty members can refresh attendance codes');
            }

            const result = attendanceService.refreshCodes(department, semester, section);
            
            // Notify all clients about the code refresh
            io.emit('updateGrid', {
                grid: result.grid,
                department,
                semester,
                section
            });
        } catch (error) {
            console.error('Error refreshing codes:', error.message);
            socket.emit('error', { message: error.message });
        }
    });

    // Handle full-screen violation
    socket.on('fullScreenViolation', async ({ department, semester, section, rollNumber, gmail, fingerprint, webRTCIPs, token, device }) => {
        console.log(`⚠️ Full-screen violation - Department: ${department}, Semester: ${semester}, Section: ${section}`);
        
        try {
            // Verify user identity from token
            const userId = socket.user.id;
            
            // Get client IP address - try different socket properties for IP
            let ipAddress = socket.handshake.headers['x-forwarded-for'] || 
                           socket.handshake.headers['x-real-ip'] ||
                           socket.handshake.address;
                           
            // If comma-separated IPs, get the first one (client IP)
            if (ipAddress && ipAddress.includes(',')) {
                ipAddress = ipAddress.split(',')[0].trim();
            }
            
            // Create request object for attendanceService
            const req = {
                ip: ipAddress,
                userName: socket.user.name,
                userAgent: socket.handshake.headers['user-agent'] || ''
            };
            
            // Handle the full-screen violation
            const result = await attendanceService.handleFullScreenViolation(
                department, 
                semester, 
                section, 
                rollNumber, 
                fingerprint, 
                webRTCIPs, 
                userId, 
                req, 
                gmail
            );
            
            // Notify the student about the result
            socket.emit('fullScreenViolationResponse', result);
            
            // If successful, update the grid for all users in the room
            if (result.success) {
                const sessionKey = attendanceService.generateSessionKey(department, semester, section);
                const sessionData = attendanceService.getSessionStatus(department, semester, section);
                
                // Broadcast updated grid to all clients in the room
                socket.to(sessionKey).emit('updateGrid', {
                    grid: sessionData.grid,
                    department,
                    semester,
                    section
                });
            }
        } catch (error) {
            console.error('Error handling full-screen violation:', error.message);
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('disconnect', () => {
        console.log('👋 User disconnected:', socket.user.name);
    });
});

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Attendance System API' });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Admin route to check server status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        time: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;