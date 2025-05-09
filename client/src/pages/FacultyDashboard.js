import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import io from "socket.io-client";
import '../styles/notifications.css';
import '../styles/GridHoverCard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

const FacultyDashboard = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    
    const [socket, setSocket] = useState(null);
    const initialGrid = Array(7).fill().map(() => Array(13).fill({ code: '', used: false }));
    const [grid, setGrid] = useState(initialGrid);
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [totalStudents, setTotalStudents] = useState('');
    const [showNotification, setShowNotification] = useState(false);
    const [notificationType, setNotificationType] = useState('success'); // 'success' or 'error'
    const [notificationMessage, setNotificationMessage] = useState('');
    const [sessionActive, setSessionActive] = useState(false);
    const [sessionTimer, setSessionTimer] = useState(0);
    const [timerInterval, setTimerInterval] = useState(null);
    const [departments] = useState(['BTech', 'BCA', 'BCom', 'BBA', 'Law', 'MCA', 'MBA', 'BPharm','BSc','']);
    const [semesters] = useState(['1', '2', '3', '4', '5', '6', '7', '8']);
    const [availableSections, setAvailableSections] = useState([]);
    const [availableTeachingAssignments, setAvailableTeachingAssignments] = useState([]);
    const [availableSemesterSections, setAvailableSemesterSections] = useState({});
    const [sessionStats, setSessionStats] = useState(null);
    const [copiedText, setCopiedText] = useState('');
    const [attendanceType, setAttendanceType] = useState('roll'); // 'roll' or 'gmail'
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [startingSession, setStartingSession] = useState(false);
    const [endingSession, setEndingSession] = useState(false);

    useEffect(() => {
        if (user?.role === 'faculty') {
            const token = localStorage.getItem('token');
            const newSocket = io(BACKEND_URL, {
                auth: {
                    token
                }
            });
            setSocket(newSocket);

            // Handle socket connection error
            newSocket.on('connect_error', (error) => {
                console.error('Socket connection error:', error.message);
                showErrorMessage('Connection error: ' + error.message);
            });

            // Handle socket error
            newSocket.on('error', (error) => {
                console.error('Socket error:', error.message);
                showErrorMessage(error.message);
            });

            return () => newSocket.close();
        }
    }, [user]);

    useEffect(() => {
        if (!loading && (!user || user.role !== 'faculty')) {
            navigate('/');
        } else if (user && user.role === 'faculty') {
            // Handle teaching assignments structure
            if (user.teachingAssignments && Array.isArray(user.teachingAssignments) && user.teachingAssignments.length > 0) {
                setAvailableTeachingAssignments(user.teachingAssignments);
                
                // Create a mapping of semester to available sections
                const semesterSections = {};
                user.teachingAssignments.forEach(assignment => {
                    if (!semesterSections[assignment.semester]) {
                        semesterSections[assignment.semester] = [];
                    }
                    semesterSections[assignment.semester].push(assignment.section);
                });
                setAvailableSemesterSections(semesterSections);
                
                // Extract unique sections from teaching assignments
                const uniqueSections = [...new Set(user.teachingAssignments.map(a => a.section))];
                setAvailableSections(uniqueSections);
            }
        }
    }, [user, loading, navigate]);

    useEffect(() => {
        if (!socket) return;

        const handleSessionStatus = (status) => {
            console.log('Received session status:', status);
            if (status && status.department === selectedDepartment && 
                status.semester === selectedSemester && 
                status.section === selectedSection) {
                setSessionActive(status.active);
                // Reset loading states when we get a response
                setStartingSession(false);
                setEndingSession(false);
                
                if (status.grid) {
                    setGrid(status.grid);
                }
                if (status.totalStudents) {
                    setTotalStudents(status.totalStudents.toString());
                }
                if (status.sessionType) {
                    setAttendanceType(status.sessionType);
                }
            }
        };

        const handleUpdateGrid = (updatedData) => {
            console.log('Received grid update:', updatedData);
            if (updatedData && updatedData.grid && 
                updatedData.department === selectedDepartment && 
                updatedData.semester === selectedSemester && 
                updatedData.section === selectedSection) {
                setGrid(updatedData.grid);
            }
        };

        const handleSessionEnded = (data) => {
            console.log('Session ended:', data);
            if (data.success && 
                data.department === selectedDepartment && 
                data.semester === selectedSemester && 
                data.section === selectedSection) {
                setSessionActive(false);
                setSessionStats({
                    totalStudents: data.totalStudents,
                    presentCount: data.presentCount,
                    absentees: data.absentees,
                    presentStudents: data.presentStudents,
                    sessionType: data.sessionType
                });
                
                // Clear session stats after 1 minute
                setTimeout(() => {
                    setSessionStats(null);
                }, 60000); // Clear stats after 1 minute
            }
        };

        const handleSuccess = (data) => {
            console.log('Success:', data);
            showSuccessMessage(data.message);
            setTimeout(() => setShowNotification(false), 3000);
        };

        const handleError = (data) => {
            console.error('Error:', data);
            showErrorMessage(data.message);
            setTimeout(() => setShowNotification(false), 3000);
        };

        socket.on('sessionStatus', handleSessionStatus);
        socket.on('updateGrid', handleUpdateGrid);
        socket.on('sessionEnded', handleSessionEnded);
        socket.on('success', handleSuccess);
        socket.on('error', handleError);

        if (selectedDepartment && selectedSemester && selectedSection) {
            socket.emit('getSessionStatus', {
                department: selectedDepartment,
                semester: selectedSemester,
                section: selectedSection
            });
        }

        return () => {
            socket.off('sessionStatus', handleSessionStatus);
            socket.off('updateGrid', handleUpdateGrid);
            socket.off('sessionEnded', handleSessionEnded);
            socket.off('success', handleSuccess);
            socket.off('error', handleError);
        };
    }, [socket, selectedDepartment, selectedSemester, selectedSection]);

    useEffect(() => {
        if (sessionActive) {
            // Start the timer when session becomes active
            const interval = setInterval(() => {
                setSessionTimer(prevTime => prevTime + 1);
            }, 1000);
            setTimerInterval(interval);
        } else {
            // Clear the timer when session ends
            if (timerInterval) {
                clearInterval(timerInterval);
                setTimerInterval(null);
            }
            setSessionTimer(0);
        }
        
        // Cleanup function
        return () => {
            if (timerInterval) {
                clearInterval(timerInterval);
            }
        };
    }, [sessionActive]);

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return [
            hours.toString().padStart(2, '0'),
            minutes.toString().padStart(2, '0'),
            secs.toString().padStart(2, '0')
        ].join(':');
    };

    const startSession = () => {
        if (!selectedDepartment || !selectedSemester || !selectedSection) {
            showErrorMessage('Please select department, semester, and section');
            return;
        }

        // For roll-based attendance, total students is required
        if (attendanceType === 'roll' && (!totalStudents || isNaN(totalStudents) || totalStudents < 1)) {
            showErrorMessage('Please enter a valid number of students');
            return;
        }

        setShowNotification(false);
        setStartingSession(true);
        
        socket.emit('startSession', {
            department: selectedDepartment,
            semester: selectedSemester,
            section: selectedSection,
            totalStudents: parseInt(totalStudents || 0),
            sessionType: attendanceType
        });
        
        // Add a timeout to reset the loading state in case the server doesn't respond
        setTimeout(() => {
            setStartingSession(false);
        }, 5000);
    };

    const endSession = () => {
        if (!selectedDepartment || !selectedSemester || !selectedSection) {
            showErrorMessage('Please select department, semester, and section');
            return;
        }

        setShowNotification(false);
        setEndingSession(true);         
        
        socket.emit('endSession', {
            department: selectedDepartment,
            semester: selectedSemester,
            section: selectedSection
        });
        
        // Add a timeout to reset the loading state in case the server doesn't respond
        setTimeout(() => {
            setEndingSession(false);
        }, 5000);
    };

    const refreshCodes = () => {
        if (!selectedDepartment || !selectedSemester || !selectedSection) {
            showErrorMessage('Please select department, semester, and section');
            return;
        }

        setShowNotification(false);
        socket.emit('refreshCodes', {
            department: selectedDepartment,
            semester: selectedSemester,
            section: selectedSection
        });
    };

    const copyAbsentees = () => {
        if (sessionStats && sessionStats.absentees) {
            const text = sessionStats.absentees.join(', ');
            navigator.clipboard.writeText(text);
            setCopiedText('Copied!');
            setTimeout(() => setCopiedText(''), 2000);
        }
    };

    const generateReport = () => {
        if (!sessionStats) {
            showErrorMessage('No session data available for report generation');
            return;
        }

        showSuccessMessage('Generating report...');

        // Prepare the report data
        const reportData = {
            department: selectedDepartment,
            semester: selectedSemester,
            section: selectedSection,
            totalStudents: sessionStats.totalStudents,
            presentStudents: sessionStats.presentStudents || [],
            absentees: sessionStats.absentees || []
        };

        // Get the token from localStorage
        const token = localStorage.getItem('token');
        
        // Make API call to generate report
        fetch(`${BACKEND_URL}/api/reports/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify(reportData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showSuccessMessage('Report generated successfully!');
                
                // Send email with the report
                return fetch(`${BACKEND_URL}/api/reports/email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({
                        ...reportData,
                        presentCount: reportData.presentStudents.length,
                        absentCount: reportData.absentees.length,
                        reportFilePath: data.filePath
                    })
                });
            } else {
                throw new Error(data.message || 'Failed to generate report');
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showSuccessMessage('Report sent to your email successfully!');
            } else {
                throw new Error(data.message || 'Failed to send report email');
            }
        })
        .catch(error => {
            console.error('Error generating or sending report:', error);
            showErrorMessage(`Error: ${error.message}`);
        });
    };

    // Function to download PDF for the current session
    const downloadPDF = async () => {
        if (!sessionStats) {
            showErrorMessage('No session data available for PDF download');
            return;
        }

        try {
            setDownloadingPdf(true);
            showSuccessMessage('Preparing PDF for download...');

            // Get the token from localStorage
            const token = localStorage.getItem('token');
            
            // Prepare the data for the attendance record
            const recordData = {
                department: selectedDepartment,
                semester: selectedSemester,
                section: selectedSection,
                totalStudents: sessionStats.totalStudents,
                presentStudents: sessionStats.presentStudents || [],
                absentees: sessionStats.absentees || [],
                sessionType: sessionStats.sessionType || 'roll'
            };

            // First, create or get the attendance record
            const createRecordResponse = await fetch(`${BACKEND_URL}/api/attendance/records`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(recordData)
            });

            const recordResult = await createRecordResponse.json();
            
            if (!recordResult.success && !recordResult._id) {
                throw new Error(recordResult.message || 'Failed to create attendance record');
            }

            // Now download the PDF directly
            const recordId = recordResult._id;
            const downloadUrl = `${BACKEND_URL}/api/attendance/records/${recordId}/download-pdf`;
            
            // Create a hidden anchor element to trigger the download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.target = '_blank';
            
            // Add the token to the URL as a query parameter
            link.href = `${downloadUrl}?token=${token}`;
            
            // Set download attribute to force download instead of navigation
            const dateStr = new Date().toISOString().split('T')[0];
            link.download = `attendance_${selectedDepartment}_${selectedSection}_${dateStr}.pdf`;
            
            // Append to body, click and remove
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showSuccessMessage('PDF download started!');
        } catch (error) {
            console.error('Error downloading PDF:', error);
            showErrorMessage(`Error: ${error.message}`);
        } finally {
            setDownloadingPdf(false);
        }
    };

    const showNotificationMessage = (message, type = 'success') => {
        setNotificationMessage(message);
        setNotificationType(type);
        setShowNotification(true);
        
        // Auto-hide notification after 10 seconds
        setTimeout(() => {
            setShowNotification(false);
        }, 10000);
    };

    const showSuccessMessage = (msg) => {
        showNotificationMessage(msg, 'success');
    };

    const showErrorMessage = (msg) => {
        showNotificationMessage(msg, 'error');
    };

    const renderContent = () => {
        if (loading) {
            return <div style={styles.loadingContainer}>Loading...</div>;
        }

        return (
            <div style={styles.container}>
                <h2 style={styles.title}>Faculty Dashboard</h2>
                
                <div style={styles.navBar}>
                    <button 
                        style={styles.navButton} 
                        onClick={() => navigate('/suspicious-activity')}
                    >
                        View Suspicious Devices
                    </button>
                    <button 
                        style={{...styles.navButton, marginLeft: '10px'}} 
                        onClick={() => navigate('/faculty/past-attendance')}
                    >
                        View Past Attendance
                    </button>
                </div>

                <div style={styles.controlPanel}>
                    <div style={styles.attendanceTypeSelector}>
                        <label style={styles.label}>Attendance Type:</label>
                        <div style={styles.attendanceTypeButtons}>
                            <button
                                onClick={() => setAttendanceType('roll')}
                                style={{
                                    ...styles.typeButton,
                                    backgroundColor: attendanceType === 'roll' ? '#4caf50' : '#f0f0f0',
                                    color: attendanceType === 'roll' ? 'white' : 'black'
                                }}
                                disabled={sessionActive}
                            >
                                Mark by Roll Number
                            </button>
                            <button
                                onClick={() => setAttendanceType('gmail')}
                                style={{
                                    ...styles.typeButton,
                                    backgroundColor: attendanceType === 'gmail' ? '#4caf50' : '#f0f0f0',
                                    color: attendanceType === 'gmail' ? 'white' : 'black'
                                }}
                                disabled={sessionActive}
                            >
                                Mark by Gmail
                            </button>
                        </div>
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Department:</label>
                        <select 
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            style={styles.select}
                            disabled={sessionActive}
                        >
                            <option value="">Select Department</option>
                            {departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Semester:</label>
                        <select 
                            value={selectedSemester}
                            onChange={(e) => {
                                const newSemester = e.target.value;
                                setSelectedSemester(newSemester);
                                // Clear section when semester changes
                                setSelectedSection('');
                            }}
                            style={styles.select}
                            disabled={sessionActive}
                        >
                            <option value="">Select Semester</option>
                            {/* Only show semesters that the faculty teaches */}
                            {Object.keys(availableSemesterSections).length > 0 && 
                                Object.keys(availableSemesterSections).sort().map(sem => (
                                    <option key={sem} value={sem}>Sem: {sem}</option>
                                ))
                            }
                        </select>
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Section:</label>
                        <select 
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                            style={styles.select}
                            disabled={sessionActive}
                        >
                            <option value="">Select Section</option>
                            {selectedSemester && availableSemesterSections[selectedSemester] && 
                                // Show only sections for the selected semester
                                availableSemesterSections[selectedSemester].map((section) => (
                                    <option key={section} value={section}>{section}</option>
                                ))
                            }
                        </select>
                    </div>

                    {attendanceType === 'roll' && (
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Total Students:</label>
                            <input
                                type="number"
                                value={totalStudents}
                                onChange={(e) => setTotalStudents(e.target.value)}
                                style={styles.input}
                                placeholder="Enter total number of students"
                                min="1"
                                disabled={sessionActive}
                            />
                        </div>
                    )}

                    <div style={styles.buttonGroup}>
                        <button
                            onClick={sessionActive ? endSession : startSession}
                            style={{
                                ...styles.button,
                                backgroundColor: sessionActive ? '#f44336' : '#4caf50',
                                flex: 2,
                                opacity: startingSession || endingSession ? 0.7 : 1,
                                cursor: startingSession || endingSession ? 'not-allowed' : 'pointer'
                            }}
                            disabled={startingSession || endingSession}
                        >
                            {sessionActive 
                                ? (endingSession ? 'Ending Session...' : 'End Session') 
                                : (startingSession ? 'Starting Session...' : 'Start Session')
                            }
                        </button>

                        {sessionActive && (
                            <button
                                onClick={refreshCodes}
                                style={{
                                    ...styles.button,
                                    backgroundColor: '#ff9800',
                                    flex: 1
                                }}
                            >
                                Refresh Codes
                            </button>
                        )}
                    </div>
                </div>

                {sessionActive && (
                    <div style={styles.sessionTimer}>
                        <span style={styles.timerLabel}>Session Time:</span>
                        <span style={styles.timerValue}>{formatTime(sessionTimer)}</span>
                    </div>
                )}

                {sessionActive && (
                    <div style={styles.gridContainer}>
                        <h3 style={styles.subtitle}>Attendance Grid</h3>
                        <div style={styles.grid}>
                            {grid.map((row, i) => (
                                <div key={i} style={styles.row}>
                                    {row.map((cell, j) => (
                                        <div
                                            key={`${i}-${j}`}
                                            style={{
                                                width: '90px',
                                                height: '90px',
                                                border: '1px solid #ddd',
                                                borderRadius: '10px',
                                                margin: '2px',
                                                display: 'flex',
                                                fontSize: '31px',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                backgroundColor: cell.used ? '#4caf50' : '#f5f5f5',
                                                color: cell.used ? 'white' : '#333',
                                                position: 'relative',
                                                cursor: 'pointer'
                                            }}
                                            className="grid-cell"
                                        >
                                            {/* Student info hover card */}
                                            <div className="student-info-card">
                                                {cell.used ? (
                                                    <div className="student-info-content">
                                                        <h3>Student Information</h3>
                                                        <p><strong>Name:</strong> {cell.studentName || 'N/A'}</p>
                                                        <p><strong>Roll Number:</strong> {cell.studentRoll || 'N/A'}</p>
                                                        <p><strong>Section:</strong> {selectedSection}</p>
                                                        <p><strong>Email:</strong> {cell.studentEmail || 'N/A'}</p>
                                                        <p><strong>Status:</strong> <span className="verified">{cell.photoFilename ? 'Verified' : 'No Photo'}</span></p>
                                                    </div>
                                                ) : (
                                                    <div className="student-info-content">
                                                        <p>Not used</p>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {cell.used && cell.photoFilename && (
                                                <div style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    zIndex: 1,
                                                }}>
                                                    <img 
                                                        src={cell.cloudinaryUrl || `${BACKEND_URL}/api/photo-verification/${cell.photoFilename}`}
                                                        alt="Student"
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover'
                                                        }}
                                                        onError={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.src = 'https://via.placeholder.com/60?text=No+Photo';
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <div style={{ fontSize: '31px', fontWeight: 'bold', position: 'relative', zIndex: 2 }}>
                                                {cell.code}
                                            </div>
                                            {cell.used && (
                                                <div style={{ 
                                                    fontSize: '31px', 
                                                    marginTop: '2px',
                                                    color: cell.photoFilename ? 'white' : '#ffeb3b',
                                                    fontWeight: 'bold',
                                                    position: 'relative',
                                                    zIndex: 2
                                                }}>
                                                    {cell.photoFilename ? 'Verified' : 'No Photo'}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {sessionStats && sessionStats.sessionType !== 'gmail' && (
                    <div style={styles.sessionStats}>
                        <h3 style={styles.statsTitle}>Session Statistics</h3>
                        
                        <div style={styles.statsGrid}>
                            <div style={styles.statsItem}>
                                <div style={styles.statsLabel}>Attendance Type</div>
                                <div style={styles.statsValue}>Roll Number-based</div>
                            </div>
                            
                            <div style={styles.statsItem}>
                                <div style={styles.statsLabel}>Total Students</div>
                                <div style={styles.statsValue}>{sessionStats.totalStudents}</div>
                            </div>
                            
                            <div style={styles.statsItem}>
                                <div style={styles.statsLabel}>Present</div>
                                <div style={styles.statsValue}>
                                    <span style={{color: '#4caf50'}}>{sessionStats.presentCount}</span>
                                </div>
                            </div>
                            
                            <div style={styles.statsItem}>
                                <div style={styles.statsLabel}>Absent</div>
                                <div style={styles.statsValue}>
                                    <span style={{color: '#f44336'}}>{sessionStats.absentees.length}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div style={styles.absenteeList}>
                            <h4 style={styles.absenteeTitle}>Absentees:</h4>
                            <div style={styles.absenteeText}>
                                {sessionStats.absentees.join(', ')}
                                <button 
                                    onClick={copyAbsentees}
                                    style={styles.copyButton}
                                >
                                    {copiedText || 'Copy'}
                                </button>
                            </div>
                        </div>
                        
                        <div style={styles.reportButtonContainer}>
                            <button 
                                onClick={generateReport}
                                style={styles.reportButton}
                            >
                                Generate Report
                            </button>
                            <button 
                                onClick={downloadPDF}
                                style={{...styles.reportButton, marginLeft: '15px', backgroundColor: '#2196f3'}}
                                disabled={downloadingPdf}
                            >
                                {downloadingPdf ? 'Preparing...' : 'Download PDF'}
                            </button>
                        </div>
                    </div>
                )}
                
                {sessionStats && sessionStats.sessionType === 'gmail' && (
                    <div style={styles.gmailMessage}>
                        <div style={styles.gmailIcon}>✓</div>
                        <h3 style={styles.gmailTitle}>Gmail-based Attendance Session Ended</h3>
                        <p style={styles.gmailText}>Attendance data has been Updated Successfully.</p>
                    </div>
                )}
            </div>
        );
    };

    const renderNotification = () => {
        if (!showNotification) return null;
        
        return (
            <div className={`notification-popup ${notificationType}`}>
                <div className="notification-icon">
                    <i className={`fas ${notificationType === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                </div>
                <div className="notification-content">
                    <p>{notificationMessage}</p>
                </div>
                <button 
                    className="notification-close"
                    onClick={() => setShowNotification(false)}
                >
                    <i className="fas fa-times"></i>
                </button>
            </div>
        );
    };

    return (
        <div style={{width: '100%', margin: 0, padding: 0}}>
            <div style={styles.container}>
                {renderContent()}
                {renderNotification()}
            </div>
        </div>
    );
};

const styles = {
    container: {
        width: 'calc(100% - 30px)',
        margin: '0 15px',
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        boxSizing: 'border-box'
    },
    attendanceTypeSelector: {
        marginBottom: '20px',
        width: '100%'
    },
    attendanceTypeButtons: {
        display: 'flex',
        gap: '10px',
        marginTop: '5px'
    },
    typeButton: {
        padding: '10px 15px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        flex: 1,
        fontWeight: 'bold',
        transition: 'background-color 0.3s',
        '&:hover': {
            backgroundColor: '#f0f0f0',
            color: 'black'
        }
    },
    title: {
        fontSize: '32px',
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: '30px',
        color: '#1a237e',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        padding: '15px 0',
        borderBottom: '3px solid #3f51b5',
        textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
    },
    subtitle: {
        fontSize: '18px',
        fontWeight: 'bold',
        marginBottom: '15px',
        color: '#283593',
    },
    controlPanel: {
        backgroundColor: '#ffffff',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '10px',
        width: '60%',
        maxWidth: '600px',
        margin: '0 auto 20px auto',
    },
    formGroup: {
        marginBottom: '15px',
    },
    label: {
        display: 'block',
        marginBottom: '5px',
        fontWeight: 'bold',
        color: '#424242',
    },
    select: {
        width: '100%',
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid #e0e0e0',
        fontSize: '14px',
        backgroundColor: '#ffffff',
    },
    input: {
        width: '100%',
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid #e0e0e0',
        fontSize: '14px',
    },
    button: {
        padding: '10px',
        color: '#ffffff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        transition: 'all 0.3s',
        '&:hover': {
            opacity: 0.9,
            transform: 'translateY(-1px)'
        }
    },
    buttonGroup: {
        display: 'flex',
        gap: '10px',
        marginTop: '20px'
    },
    gridContainer: {
        backgroundColor: '#ffffff',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '30px',
        width: '100%',
        overflowX: 'auto',
    },
    grid: {
        display: 'grid',
        gap: '8px',
        width: '100%',
        minWidth: 'fit-content',
    },
    row: {
        display: 'grid',
        gridTemplateColumns: 'repeat(13, minmax(60px, 1fr))',
        gap: '8px',
        width: '100%',
    },
    sessionStats: {
        backgroundColor: '#ffffff',
        padding: '25px',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        margin: '20px 0',
        width: '100%',
    },
    statsTitle: {
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '20px',
        color: '#1a237e',
        textAlign: 'center',
        borderBottom: '2px solid #3f51b5',
        paddingBottom: '10px',
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '25px',
    },
    statsItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
            transform: 'translateY(-5px)',
            boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        },
    },
    statsLabel: {
        color: '#757575',
        fontSize: '14px',
        marginBottom: '10px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '1px',
    },
    statsValue: {
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#283593',
    },
    absenteeList: {
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
    },
    absenteeTitle: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#424242',
        marginBottom: '10px',
    },
    absenteeText: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '16px',
        lineHeight: '1.5',
        color: '#616161',
        wordBreak: 'break-word',
    },
    copyButton: {
        marginLeft: '15px',
        padding: '5px 15px',
        backgroundColor: '#3f51b5',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        minWidth: '80px',
        transition: 'background-color 0.2s',
        '&:hover': {
            backgroundColor: '#303f9f',
        },
    },
    reportButtonContainer: {
        display: 'flex',
        justifyContent: 'center',
        marginTop: '25px',
    },
    reportButton: {
        padding: '12px 25px',
        backgroundColor: '#ff9800',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        transition: 'all 0.3s',
        '&:hover': {
            backgroundColor: '#f57c00',
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        },
    },
    gmailMessage: {
        backgroundColor: '#ffffff',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        margin: '20px 0',
        width: '100%',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gmailIcon: {
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        backgroundColor: '#4caf50',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '32px',
        fontWeight: 'bold',
        marginBottom: '20px',
        boxShadow: '0 4px 8px rgba(76, 175, 80, 0.3)',
    },
    gmailTitle: {
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '15px',
        color: '#1a237e',
    },
    gmailText: {
        fontSize: '16px',
        color: '#616161',
        marginBottom: '5px',
    },
    statsValue: {
        color: '#2196f3',
        fontSize: '28px',
        fontWeight: 'bold',
    },
    absenteesContainer: {
        marginTop: '20px',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
    },
    absenteesTitle: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#333',
        marginBottom: '15px',
    },
    absenteesList: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
    },
    absenteeItem: {
        backgroundColor: '#ffffff',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '14px',
        color: '#f44336',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    copyButton: {
        backgroundColor: '#2196f3',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '8px 16px',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'background-color 0.3s',
        '&:hover': {
            backgroundColor: '#1976d2',
        },
    },
    navBar: {
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '10px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px',
    },
    navButton: {
        backgroundColor: '#2196f3',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '8px 16px',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'background-color 0.3s',
        '&:hover': {
            backgroundColor: '#1976d2',
        },
    },
    loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#666'
    },
    sessionTimer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        padding: '10px 15px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px',
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 100,
    },
    timerLabel: {
        fontWeight: 'bold',
        marginRight: '10px',
        color: '#555',
    },
    timerValue: {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#2196f3',
        fontWeight: 'bold',
    },
    markedCell: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: '#66bb6a',
        borderRadius: '10px',
        overflow: 'hidden',
    },
    studentPhoto: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
    },
    studentInfo: {
        textAlign: 'center',
    },
    studentName: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#ffffff',
        textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
    },
    studentRoll: {
        fontSize: '12px',
        color: '#ffffff',
        textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
    },
};

export default FacultyDashboard;