import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import io from "socket.io-client";
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import getWebRTCIPs from '../utils/webRTCDetector';
import '../styles/StudentDashboard.css';
import '../styles/FullScreenWarning.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

const StudentDashboard = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    
    // All useState hooks at the top level
    const [socket, setSocket] = useState(null);
    const [fingerprint, setFingerprint] = useState(null);
    const [webRTCIPs, setWebRTCIPs] = useState(null);
    const initialGrid = Array(7).fill().map(() => Array(11).fill({ code: '', used: false }));
    const [grid, setGrid] = useState(initialGrid);
    const [selectedSemester, setSelectedSemester] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [sessionActive, setSessionActive] = useState(false);
    const [sessionStats, setSessionStats] = useState(null);
    const [sessionType, setSessionType] = useState('roll'); // 'roll' or 'gmail'
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showFullScreenWarning, setShowFullScreenWarning] = useState(false);
    const [fullScreenExitTimeout, setFullScreenExitTimeout] = useState(null);
    const fullScreenRequestedRef = useRef(false);

    // Initialize fingerprint and WebRTC IPs
    useEffect(() => {
        const initDeviceIdentifiers = async () => {
            try {
                // Get fingerprint
                const fp = await FingerprintJS.load();
                const result = await fp.get();
                setFingerprint(result.visitorId);

                // Get WebRTC IPs
                const ips = await getWebRTCIPs();
                setWebRTCIPs(ips);
                console.log('WebRTC IPs detected:', ips);
            } catch (error) {
                console.error('Error generating device identifiers:', error);
                setError('Failed to generate device identifiers');
            }
        };
        initDeviceIdentifiers();
    }, []);

    // Socket connection effect
    useEffect(() => {
        if (user?.role === 'student') {
            const token = localStorage.getItem('token');
            const newSocket = io(BACKEND_URL, {
                auth: {
                    token
                }
            });
            setSocket(newSocket);
            return () => newSocket.close();
        }
    }, [user]);

    // Authentication check effect
    useEffect(() => {
        if (!loading && (!user || user.role !== 'student')) {
            navigate('/');
        } else if (user && user.role === 'student' && user.semester) {
            // Auto-select the semester from user data
            setSelectedSemester(user.semester);
        }
    }, [user, loading, navigate]);

    // Socket event listeners effect
    useEffect(() => {
        if (!socket) return;

        const handleSessionStatus = (status) => {
            console.log('Received session status:', status);
            if (status && status.department === user.course && 
                status.semester === selectedSemester && 
                status.section === user.section) {
                setSessionActive(status.active);
                if (status.grid) {
                    setGrid(status.grid);
                }
                // Store session type (roll or gmail)
                if (status.sessionType) {
                    setSessionType(status.sessionType);
                }
                
                // If session is active and we haven't requested fullscreen yet, request it
                if (status.active && !fullScreenRequestedRef.current) {
                    requestFullScreen();
                    fullScreenRequestedRef.current = true;
                }
                
                // Handle codes refreshed notification
                if (status.codesRefreshed) {
                    // Clear any previous error messages
                    setError('');
                    
                    // Check if this student has already marked attendance
                    const hasMarkedAttendance = message.includes('successfully') || message.includes('marked');
                    
                    if (hasMarkedAttendance) {
                        // Student already marked attendance - no action needed
                        setMessage('Attendance codes have been refreshed, but you have already marked your attendance.');
                    } else {
                        // Student hasn't marked attendance yet - they can use the new codes
                        setMessage('Attendance codes have been refreshed. You can now mark your attendance with the new codes!');
                    }
                    
                    // Clear the message after 10 seconds
                    setTimeout(() => setMessage(''), 10000);
                }
            }
        };

        const handleUpdateGrid = (updatedData) => {
            console.log('Received grid update:', updatedData);
            if (updatedData && updatedData.grid && 
                updatedData.department === user.course && 
                updatedData.semester === selectedSemester && 
                updatedData.section === user.section) {
                setGrid(updatedData.grid);
            }
        };

        const handleSessionEnded = (data) => {
            console.log('Session ended:', data);
            if (data.success && 
                data.department === user.course && 
                data.semester === selectedSemester && 
                data.section === user.section) {
                setSessionActive(false);
                setSessionStats({
                    totalStudents: data.totalStudents,
                    presentCount: data.presentCount,
                    absentees: data.absentees,
                    sessionType: data.sessionType
                });
                setTimeout(() => {
                    setSessionStats(null);
                }, 60000); // Clear stats after 1 minute
            }
        };

        const handleError = (data) => {
            console.error('Error:', data);
            setError(data.message);
            setTimeout(() => setError(''), 3000);
        };

        const handleAttendanceResponse = (response) => {
            if (response.success) {
                setMessage('Attendance marked successfully!');
                setError('');
            } else {
                setError(response.message || 'Failed to mark attendance');
                setMessage('');
            }
        };

        const handleFullScreenViolationResponse = (response) => {
            if (response.success) {
                setMessage('');
                setError(response.message || 'You have been marked absent due to exiting full-screen mode');
            } else {
                setError(response.message || 'Error processing full-screen violation');
            }
        };

        socket.on('sessionStatus', handleSessionStatus);
        socket.on('updateGrid', handleUpdateGrid);
        socket.on('sessionEnded', handleSessionEnded);
        socket.on('error', handleError);
        socket.on('attendanceResponse', handleAttendanceResponse);
        socket.on('fullScreenViolationResponse', handleFullScreenViolationResponse);

        // Check current session status when mounting or changing semester
        if (selectedSemester) {
            socket.emit('getSessionStatus', {
                department: user.course,
                semester: selectedSemester,
                section: user.section
            });
        }

        return () => {
            socket.off('sessionStatus', handleSessionStatus);
            socket.off('updateGrid', handleUpdateGrid);
            socket.off('sessionEnded', handleSessionEnded);
            socket.off('error', handleError);
            socket.off('attendanceResponse', handleAttendanceResponse);
            socket.off('fullScreenViolationResponse', handleFullScreenViolationResponse);
        };
    }, [socket, selectedSemester, user]);

    // Session status check effect
    useEffect(() => {
        if (!socket || !user) return;
        
        if (selectedSemester) {
            socket.emit('getSessionStatus', {
                department: user.course,
                semester: selectedSemester,
                section: user.section
            });
            setError('');
            setMessage('');
        }
    }, [socket, selectedSemester, user]);

    // Add full-screen change detection
    useEffect(() => {
        // Function to check if we're in full-screen mode
        const checkFullScreen = () => {
            const isInFullScreen = 
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement;
            
            setIsFullScreen(!!isInFullScreen);
            
            // If we were in full-screen but now we're not, and there's an active session
            if (!isInFullScreen && sessionActive && fullScreenRequestedRef.current) {
                handleFullScreenExit();
            }
        };

        // Function to handle visibility change (tab switching)
        const handleVisibilityChange = () => {
            if (document.hidden && sessionActive && isFullScreen) {
                // User switched tabs while in full-screen mode
                handleFullScreenExit();
            }
        };

        // Function to handle when app loses focus (mobile)
        const handleAppBlur = () => {
            if (sessionActive && isFullScreen) {
                // User minimized the browser or switched apps
                handleFullScreenExit();
            }
        };

        // Function to handle page unload/navigation
        const handleBeforeUnload = (e) => {
            if (sessionActive && isFullScreen) {
                // User is navigating away or closing the browser
                // Note: This won't prevent navigation, just record the violation
                socket.emit('fullScreenViolation', {
                    department: user.course,
                    semester: selectedSemester,
                    section: user.section,
                    rollNumber: sessionType === 'roll' ? user.classRollNumber : null,
                    gmail: sessionType === 'gmail' ? user.email : null,
                    fingerprint,
                    webRTCIPs,
                    token: localStorage.getItem("token"),
                    device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "pc" 
                });
            }
        };

        // Add event listeners
        document.addEventListener('fullscreenchange', checkFullScreen);
        document.addEventListener('webkitfullscreenchange', checkFullScreen);
        document.addEventListener('mozfullscreenchange', checkFullScreen);
        document.addEventListener('MSFullscreenChange', checkFullScreen);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleAppBlur);
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Cleanup
        return () => {
            document.removeEventListener('fullscreenchange', checkFullScreen);
            document.removeEventListener('webkitfullscreenchange', checkFullScreen);
            document.removeEventListener('mozfullscreenchange', checkFullScreen);
            document.removeEventListener('MSFullscreenChange', checkFullScreen);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleAppBlur);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [sessionActive, isFullScreen, socket, user, selectedSemester, sessionType, fingerprint, webRTCIPs]);

    // Function to request full-screen
    const requestFullScreen = () => {
        const docEl = document.documentElement;
        
        const requestMethod = 
            docEl.requestFullscreen || 
            docEl.webkitRequestFullscreen || 
            docEl.mozRequestFullScreen || 
            docEl.msRequestFullscreen;
            
        if (requestMethod) {
            requestMethod.call(docEl);
        }
    };

    // Function to exit full-screen
    const exitFullScreen = () => {
        const exitMethod = 
            document.exitFullscreen || 
            document.webkitExitFullscreen || 
            document.mozCancelFullScreen || 
            document.msExitFullscreen;
            
        if (exitMethod) {
            exitMethod.call(document);
        }
    };

    // Function to handle full-screen exit
    const handleFullScreenExit = () => {
        // Only show warning if we're not already showing it
        if (!showFullScreenWarning) {
            setShowFullScreenWarning(true);
            
            // Set a timeout to mark the student absent if they don't return to full-screen
            const timeout = setTimeout(() => {
                if (socket && sessionActive) {
                    socket.emit('fullScreenViolation', {
                        department: user.course,
                        semester: selectedSemester,
                        section: user.section,
                        rollNumber: sessionType === 'roll' ? user.classRollNumber : null,
                        gmail: sessionType === 'gmail' ? user.email : null,
                        fingerprint,
                        webRTCIPs,
                        token: localStorage.getItem("token"), // sending token for verification
                        device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "pc" 
                    });
                }
            }, 5000); // 30 seconds
            setFullScreenExitTimeout(timeout);
        }
    };

    // Function to handle returning to full-screen
    const handleReturnToFullScreen = () => {
        // Clear the timeout to prevent marking absent
        if (fullScreenExitTimeout) {
            clearTimeout(fullScreenExitTimeout);
            setFullScreenExitTimeout(null);
        }
        
        // Hide the warning
        setShowFullScreenWarning(false);
        
        // Request full-screen again
        requestFullScreen();
    };

    // Function to confirm exit from full-screen
    const handleConfirmExit = () => {
        // Clear the timeout since user has confirmed exit
        if (fullScreenExitTimeout) {
            clearTimeout(fullScreenExitTimeout);
            setFullScreenExitTimeout(null);
        }
        
        // Hide the warning
        setShowFullScreenWarning(false);
        
        // Mark the student as absent due to full-screen violation
        if (socket && sessionActive) {
            socket.emit('fullScreenViolation', {
                department: user.course,
                semester: selectedSemester,
                section: user.section,
                rollNumber: sessionType === 'roll' ? user.classRollNumber : null,
                gmail: sessionType === 'gmail' ? user.email : null,
                fingerprint,
                webRTCIPs,
                token: localStorage.getItem("token"), // sending token for verification
                device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "pc" 
            });
        }
    };

    const markAttendance = () => {
        if (!code) {
            setError('Please enter the attendance code');
            return;
        }

        if (!socket) {
            setError('Not connected to server');
            return;
        }

        if (!fingerprint || !webRTCIPs) {
            setError('Device identification not ready. Please wait a few seconds and try again.');
            return;
        }

        // Check if in full-screen mode
        if (!isFullScreen) {
            setError('You must be in full-screen mode to mark attendance. Please click the "Enter Full Screen" button.');
            return;
        }

        // For roll-based sessions, validate roll number
        if (sessionType === 'roll' && (!user.classRollNumber || !/^\d{2}$/.test(user.classRollNumber))) {
            setError('Invalid roll number format in your profile');
            return;
        }
        
        // For Gmail-based sessions, validate email
        if (sessionType === 'gmail' && !user.email) {
            setError('Email is required for Gmail-based attendance');
            return;
        }

        console.log('Marking attendance with WebRTC IPs:', webRTCIPs);
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        socket.emit('markAttendance', {
            department: user.course,
            semester: selectedSemester,
            section: user.section,
            rollNumber: sessionType === 'roll' ? user.classRollNumber : null,
            gmail: sessionType === 'gmail' ? user.email : null,
            code,
            fingerprint,
            webRTCIPs,
            token: localStorage.getItem("token"), // sending token for verification
            device: isMobile ? "mobile" : "pc" 
        });

        // Clear code input after submission
        setCode('');
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="loading-container">
                    <div className="loading-text">Loading your profile data...</div>
                </div>
            );
        }

        if (!user) {
            return (
                <div className="loading-container">
                    <div className="error-text">Please log in to access the dashboard</div>
                </div>
            );
        }

        if (user.role !== 'student') {
            return (
                <div className="loading-container">
                    <div className="error-text">Access denied. Student role required.</div>
                </div>
            );
        }

        if (!socket) {
            return (
                <div className="loading-container">
                    <div className="loading-text">Connecting to attendance server...</div>
                </div>
            );
        }

        if (!user.course || !user.section) {
            return (
                <div className="loading-container">
                    <div className="error-text">
                        Your profile is missing required information (department or section).
                        Please contact your administrator.
                    </div>
                </div>
            );
        }

        return (
            <div className="container">
                <h2 className="title">Student Dashboard</h2>
                
                {isFullScreen && (
                    <div className="fullscreen-indicator">
                        <i className="fas fa-expand"></i>
                        Full-screen mode active
                    </div>
                )}
                
                <div className="control-panel">
                    <div className="form-group">
                        <label className="label">Department:</label>
                        <input 
                            type="text"
                            value={user.course}
                            className="input"
                            disabled={true}
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">Semester:</label>
                        <input 
                            type="text"
                            value={user.semester}
                            className="input"
                            disabled={true}
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">Section:</label>
                        <input 
                            type="text"
                            value={user.section}
                            className="input"
                            disabled={true}
                        />
                    </div>
                </div>

                {selectedSemester && (
                    <div className="session-info">
                        <h3 className={sessionActive ? "session-status active" : "session-status"}>
                            {sessionActive 
                                ? `Active Session: ${user.course} - Semester ${selectedSemester} - Section ${user.section}`
                                : 'No Active Session'}
                        </h3>
                    </div>
                )}

                {sessionActive && (
                    <div className="mobile-container">
                        {!isFullScreen && (
                            <div className="fullscreen-prompt">
                                <p>You must be in full-screen mode to mark attendance.</p>
                                <button 
                                    onClick={requestFullScreen}
                                    className="mark-button"
                                >
                                    Enter Full Screen
                                </button>
                            </div>
                        )}
                        
                        <div className="session-type-indicator">
                            <div className={`session-type ${sessionType === 'gmail' ? 'gmail' : 'roll'}`}>
                                {sessionType === 'gmail' ? 'Gmail-based Attendance' : 'Roll Number-based Attendance'}
                            </div>
                        </div>
                        <div className="mini-grid-container">
                            <div className="mini-grid">
                                {grid.map((row, i) => (
                                    <div key={i} className="mini-row">
                                        {row.map((cell, j) => (
                                            <div
                                                key={`${i}-${j}`}
                                                className={cell.used ? "mini-cell used" : "mini-cell"}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="form-container">
                            <h3 className="subtitle">Mark Attendance</h3>
                            <div className="form-group">
                                <label className="label">{sessionType === 'gmail' ? 'Email:' : 'Roll Number:'}</label>
                                <input
                                    type="text"
                                    value={sessionType === 'gmail' ? user.email : user.classRollNumber}
                                    className="input"
                                    disabled={true}
                                />
                            </div>

                            <div className="form-group">
                                <label className="label">Attendance Code:</label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="input"
                                    placeholder="Enter attendance code"
                                />
                            </div>

                            <button 
                                onClick={markAttendance}
                                className="mark-button"
                            >
                                Mark Attendance
                            </button>
                        </div>
                    </div>
                )}

                {sessionStats && (
                    <div className="stats-container">
                        <h3 className="stats-title">Session Statistics</h3>
                        <div className="stats-grid">
                            <div className="stats-card">
                                <span className="stats-icon">ℹ️</span>
                                <div className="stats-info">
                                    <span className="stats-label">Attendance Type</span>
                                    <span className="stats-value">{sessionStats.sessionType === 'gmail' ? 'Gmail-based' : 'Roll-based'}</span>
                                </div>
                            </div>

                            <div className="stats-card">
                                <span className="stats-icon">👥</span>
                                <div className="stats-info">
                                    <span className="stats-label">Total Students</span>
                                    <span className="stats-value">{sessionStats.totalStudents}</span>
                                </div>
                            </div>

                            <div className="stats-card">
                                <span className="stats-icon">✅</span>
                                <div className="stats-info">
                                    <span className="stats-label">Present</span>
                                    <span className="stats-value">{sessionStats.presentCount}</span>
                                </div>
                            </div>

                            {sessionStats.sessionType !== 'gmail' && (
                                <div className="stats-card">
                                    <span className="stats-icon">❌</span>
                                    <div className="stats-info">
                                        <span className="stats-label">Absent</span>
                                        <span className="stats-value">{sessionStats.absentees.length}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="absentees-container">
                            <h4 className="absentees-title">Absentee Roll Numbers</h4>
                            <div className="absentees-list">
                                {sessionStats.absentees.map(roll => (
                                    <span key={roll} className="absentee-badge">{roll}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {(error || message) && (
                    <div className="message-container">
                        {error && <div className="error-text">{error}</div>}
                        {message && <div className="success-text">{message}</div>}
                    </div>
                )}
                
                {/* Full-screen exit warning modal */}
                {showFullScreenWarning && (
                    <div className="fullscreen-warning-overlay">
                        <div className="fullscreen-warning-container">
                            <div className="fullscreen-warning-icon">
                                <i className="fas fa-exclamation-triangle"></i>
                            </div>
                            <h3 className="fullscreen-warning-title">Warning!</h3>
                            <p className="fullscreen-warning-message">
                                You have exited full-screen mode. This action will mark you as absent.
                                Do you want to return to full-screen mode or exit anyway?
                            </p>
                            <div className="fullscreen-warning-buttons">
                                <button 
                                    className="fullscreen-warning-exit-btn"
                                    onClick={handleConfirmExit}
                                >
                                    Exit (Mark Absent)
                                </button>
                                <button 
                                    className="fullscreen-warning-return-btn"
                                    onClick={handleReturnToFullScreen}
                                >
                                    Return to Page
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return renderContent();
};

export default StudentDashboard;