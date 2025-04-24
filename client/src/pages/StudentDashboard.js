import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import io from "socket.io-client";
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import getWebRTCIPs from '../utils/webRTCDetector';
import '../styles/StudentDashboard.css';

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

        socket.on('sessionStatus', handleSessionStatus);
        socket.on('updateGrid', handleUpdateGrid);
        socket.on('sessionEnded', handleSessionEnded);
        socket.on('error', handleError);
        socket.on('attendanceResponse', handleAttendanceResponse);

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
            </div>
        );
    };

    return renderContent();
};

export default StudentDashboard;