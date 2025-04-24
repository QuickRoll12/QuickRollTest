import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/FacultyPastAttendance.css';

const FacultyPastAttendance = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAttendanceRecords();
  }, []);

  useEffect(() => {
    // Apply filters whenever filter values or records change
    applyFilters();
  }, [records, dateFilter, sectionFilter, departmentFilter]);

  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      console.log('Fetching attendance records...');
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
      const url = `${BACKEND_URL}/api/attendance/records`;
      console.log('API URL:', url);
      console.log('Token available:', !!token);
      
      const response = await axios.get(
        url,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      console.log('Attendance records response:', response.data);
      setRecords(response.data);
      setFilteredRecords(response.data);
      setError('');
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      setError(`Failed to fetch attendance records: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...records];
    
    // Apply date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filterDate.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.date);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate.getTime() === filterDate.getTime();
      });
    }
    
    // Apply section filter
    if (sectionFilter) {
      filtered = filtered.filter(record => 
        record.section.toLowerCase().includes(sectionFilter.toLowerCase())
      );
    }
    
    // Apply department filter
    if (departmentFilter) {
      filtered = filtered.filter(record => 
        record.department.toLowerCase().includes(departmentFilter.toLowerCase())
      );
    }
    
    // If no filters, show only last 5 days
    if (!dateFilter && !sectionFilter && !departmentFilter) {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= fiveDaysAgo;
      });
    }
    
    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    setFilteredRecords(filtered);
  };

  const resetFilters = () => {
    setDateFilter('');
    setSectionFilter('');
    setDepartmentFilter('');
    setFilteredRecords(records);
  };

  const handleViewDetails = (record) => {
    setSelectedRecord(record);
  };

  const closeDetails = () => {
    setSelectedRecord(null);
  };

  const handleDownloadPDF = async (recordId) => {
    try {
      setDownloadLoading(true);
      const token = localStorage.getItem('token');
      
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
      const url = `${BACKEND_URL}/api/attendance/records/${recordId}/download-pdf`;
      
      console.log('Downloading PDF from:', url);
      
      // Use fetch for blob response
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      // Get the blob from response
      const blob = await response.blob();
      
      // Create a URL for the blob
      const downloadUrl = window.URL.createObjectURL(blob);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Get record details for filename
      const record = records.find(r => r._id === recordId);
      const dateStr = new Date(record.date).toISOString().split('T')[0];
      
      // Set download filename
      link.download = `attendance_${record.department}_${record.section}_${dateStr}.pdf`;
      
      // Append to body, click and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL
      window.URL.revokeObjectURL(downloadUrl);
      
      setError('');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      setError(`Failed to download PDF: ${error.message || 'Unknown error'}`);
    } finally {
      setDownloadLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Function to copy roll numbers to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        showSuccessMessage('Roll numbers copied to clipboard!');
      })
      .catch((error) => {
        console.error('Error copying to clipboard:', error);
        showErrorMessage('Failed to copy to clipboard');
      });
  };

  // Function to handle copying present roll numbers
  const handleCopyPresent = (record) => {
    if (!record.presentStudents || record.presentStudents.length === 0) {
      showErrorMessage('No present students to copy');
      return;
    }
    
    const rollNumbers = record.presentStudents.sort().join(', ');
    copyToClipboard(rollNumbers);
  };

  // Function to handle copying absent roll numbers
  const handleCopyAbsent = (record) => {
    if (!record.absentees || record.absentees.length === 0) {
      showErrorMessage('No absent students to copy');
      return;
    }
    
    const rollNumbers = record.absentees.sort().join(', ');
    copyToClipboard(rollNumbers);
  };

  // Function to show success message
  const showSuccessMessage = (message) => {
    const messageElement = document.createElement('div');
    messageElement.className = 'success-message';
    messageElement.textContent = message;
    document.body.appendChild(messageElement);
    
    setTimeout(() => {
      messageElement.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      messageElement.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(messageElement);
      }, 300);
    }, 3000);
  };

  // Function to show error message
  const showErrorMessage = (message) => {
    const messageElement = document.createElement('div');
    messageElement.className = 'error-message';
    messageElement.textContent = message;
    document.body.appendChild(messageElement);
    
    setTimeout(() => {
      messageElement.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      messageElement.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(messageElement);
      }, 300);
    }, 3000);
  };

  return (
    <div className="past-attendance-container">
      <div className="header">
        <h2>Past Attendance Records</h2>
        <button 
          className="back-button" 
          onClick={() => navigate('/faculty')}
        >
          <i className="fas fa-arrow-left"></i> Back to Dashboard
        </button>
      </div>

      <div className="filters-container">
        <h3>Filter Records</h3>
        <div className="filters">
          <div className="filter-group">
            <label>Date:</label>
            <input 
              type="date" 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <label>Section:</label>
            <input 
              type="text" 
              placeholder="Filter by section" 
              value={sectionFilter} 
              onChange={(e) => setSectionFilter(e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <label>Department:</label>
            <input 
              type="text" 
              placeholder="Filter by department" 
              value={departmentFilter} 
              onChange={(e) => setDepartmentFilter(e.target.value)}
            />
          </div>
          
          <button 
            className="reset-button" 
            onClick={resetFilters}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      
      {loading ? (
        <div className="loading">
          <i className="fas fa-spinner fa-spin"></i> Loading records...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="no-records">
          <i className="fas fa-folder-open"></i>
          <p>No attendance records found</p>
          {(dateFilter || sectionFilter || departmentFilter) && (
            <p>Try adjusting your filters</p>
          )}
        </div>
      ) : (
        <div className="attendance-records-list">
          {filteredRecords.map((record) => (
            <div key={record._id} className="attendance-card">
              <div className="attendance-header">
                <div className="attendance-title">
                  <h3>{record.department} - {record.section}</h3>
                  <span className="attendance-date">{formatDate(record.date)}</span>
                </div>
                <div className="attendance-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total:</span>
                    <span className="stat-value">{record.totalStudents}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Present:</span>
                    <span className="stat-value">{record.presentCount}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Absent:</span>
                    <span className="stat-value">{record.totalStudents - record.presentCount}</span>
                  </div>
                </div>
              </div>
              
              <div className="attendance-details">
                <div className="student-lists">
                  <div className="present-list">
                    <h4>Present Students</h4>
                    <div className="roll-numbers">
                      {record.presentStudents && record.presentStudents.length > 0 ? (
                        record.presentStudents.sort().map((roll, index) => (
                          <span key={index} className="roll-badge present">{roll}</span>
                        ))
                      ) : (
                        <p className="empty-message">No students present</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="absent-list">
                    <h4>Absent Students</h4>
                    <div className="roll-numbers">
                      {record.absentees && record.absentees.length > 0 ? (
                        record.absentees.sort().map((roll, index) => (
                          <span key={index} className="roll-badge absent">{roll}</span>
                        ))
                      ) : (
                        <p className="empty-message">No students absent</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="attendance-actions">
                <button 
                  className="download-button" 
                  onClick={() => handleDownloadPDF(record._id)}
                  disabled={downloadLoading}
                >
                  <i className="fas fa-download"></i> Download PDF
                </button>
                <button 
                  className="email-button" 
                  onClick={() => window.open(`mailto:?subject=Attendance Report - ${record.department} ${record.section}&body=Attendance report for ${formatDate(record.date)}%0A%0ATotal Students: ${record.totalStudents}%0APresent: ${record.presentCount}%0AAbsent: ${record.totalStudents - record.presentCount}`)}
                >
                  <i className="fas fa-envelope"></i> Email Report
                </button>
                <button 
                  className="copy-button copy-present" 
                  onClick={() => handleCopyPresent(record)}
                >
                  <i className="fas fa-copy"></i> Copy Present
                </button>
                <button 
                  className="copy-button copy-absent" 
                  onClick={() => handleCopyAbsent(record)}
                >
                  <i className="fas fa-copy"></i> Copy Absent
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FacultyPastAttendance;