import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/AdminFacultyRequests.css';

// Use environment variable directly instead of importing from config
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

const AdminFacultyRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const navigate = useNavigate();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${BACKEND_URL}/api/admin/faculty-requests`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching faculty requests:', error);
      setError('Failed to load faculty requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      setActionLoading(requestId);
      const token = localStorage.getItem('token');
      
      await axios.post(`${BACKEND_URL}/api/admin/approve-faculty/${requestId}`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Update the request status in the UI
      setRequests(requests.map(req => 
        req._id === requestId ? { ...req, status: 'approved' } : req
      ));
      
      setNotification({
        message: 'Faculty account approved successfully. Credentials have been sent via email.',
        type: 'success'
      });
      
      // Clear notification after 5 seconds
      setTimeout(() => {
        setNotification({ message: '', type: '' });
      }, 5000);
    } catch (error) {
      console.error('Error approving faculty request:', error);
      setNotification({
        message: error.response?.data?.message || 'Failed to approve faculty request.',
        type: 'error'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId) => {
    try {
      setActionLoading(requestId);
      const token = localStorage.getItem('token');
      
      await axios.post(`${BACKEND_URL}/api/admin/reject-faculty/${requestId}`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Update the request status in the UI
      setRequests(requests.map(req => 
        req._id === requestId ? { ...req, status: 'rejected' } : req
      ));
      
      setNotification({
        message: 'Faculty request rejected successfully.',
        type: 'success'
      });
      
      // Clear notification after 5 seconds
      setTimeout(() => {
        setNotification({ message: '', type: '' });
      }, 5000);
    } catch (error) {
      console.error('Error rejecting faculty request:', error);
      setNotification({
        message: error.response?.data?.message || 'Failed to reject faculty request.',
        type: 'error'
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Format date for better readability
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  if (loading) {
    return (
      <div className="faculty-requests-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading faculty requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="faculty-requests-container">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={fetchRequests} className="retry-button">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="faculty-requests-container">
      <h2>Faculty Account Requests</h2>
      
      <div className="admin-actions">
        <button 
          onClick={() => navigate('/admin/upload-data')} 
          className="upload-data-button"
        >
          <i className="fas fa-upload"></i> Upload Student Data
        </button>
      </div>
      
      {notification.message && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
      
      {requests.length === 0 ? (
        <div className="no-requests">
          <p>No faculty account requests found.</p>
        </div>
      ) : (
        <div className="requests-list">
          {requests.map(request => (
            <div key={request._id} className={`request-card ${request.status}`}>
              <div className="request-header">
                <h3>{request.name}</h3>
                <span className={`status-badge ${request.status}`}>
                  {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                </span>
              </div>
              
              <div className="request-details">
                <div className="detail-row">
                  <span className="detail-label">Email:</span>
                  <span className="detail-value">{request.email}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Department:</span>
                  <span className="detail-value">{request.department}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Sections:</span>
                  <span className="detail-value">
                    {request.sectionsTeaching && request.sectionsTeaching.length > 0 ? (
                      <div className="sections-tags">
                        {request.sectionsTeaching.map((section, index) => (
                          <span key={index} className="section-tag-admin">{section}</span>
                        ))}
                      </div>
                    ) : (
                      'None specified'
                    )}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Submitted:</span>
                  <span className="detail-value">{formatDate(request.createdAt)}</span>
                </div>
              </div>
              
              <div className="id-card-preview">
                <h4>ID Card Photo</h4>
                <img src={request.photoUrl} alt="Faculty ID Card" />
              </div>
              
              {request.status === 'pending' && (
                <div className="request-actions">
                  <button 
                    onClick={() => handleApprove(request._id)} 
                    className="approve-button"
                    disabled={actionLoading === request._id}
                  >
                    {actionLoading === request._id ? 'Processing...' : 'Approve'}
                  </button>
                  <button 
                    onClick={() => handleReject(request._id)} 
                    className="reject-button"
                    disabled={actionLoading === request._id}
                  >
                    {actionLoading === request._id ? 'Processing...' : 'Reject'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminFacultyRequests;