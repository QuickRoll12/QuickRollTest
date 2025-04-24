import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/FacultyRequestForm.css';
import '../styles/notifications.css';

// Use environment variable directly instead of importing from config
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

const FacultyRequestForm = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [sectionsTeaching, setSectionsTeaching] = useState([]);
  const [sectionInput, setSectionInput] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState('error');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [availableSections, setAvailableSections] = useState([
    'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E1', 'E2', 'F1', 'F2', 'G1', 'G2', 'H1', 'H2', 'I1', 'I2', 'J1', 'J2', 'K1', 'K2', 'L1', 'L2', 'Placement Group 1', 'Placement Group 2', 'Placement Group 3', 'Placement Group 4', 'Placement Group 5'
  ]);
  const navigate = useNavigate();
  
  const departments = ['BTech', 'BCA', 'BCom', 'BBA', 'Law', 'MCA', 'MBA', 'BPharm', 'BSc'];
  
  // Function to show notifications
  const showNotificationMessage = (message, type = 'error') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    
    // Auto-hide notification after 5 seconds
    setTimeout(() => {
      setShowNotification(false);
    }, 5000);
  };
  
  const validateForm = () => {
    if (!name.trim()) {
      showNotificationMessage('Please enter your full name', 'error');
      return false;
    }

    if (!email.trim()) {
      showNotificationMessage('Please enter your email address', 'error');
      return false;
    }

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      showNotificationMessage('Please enter a valid email address', 'error');
      return false;
    }

    if (!department) {
      showNotificationMessage('Please select your department', 'error');
      return false;
    }

    if (sectionsTeaching.length === 0) {
      showNotificationMessage('Please add at least one section that you teach', 'error');
      return false;
    }

    if (!photo) {
      showNotificationMessage('Please upload your ID card photo', 'error');
      return false;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (photo.size > maxSize) {
      showNotificationMessage('Photo size should not exceed 5MB', 'error');
      return false;
    }

    return true;
  };
  
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'];
      if (!validTypes.includes(file.type)) {
        showNotificationMessage('Please upload a valid image file (JPG, JPEG, or PNG)', 'error');
        return;
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        showNotificationMessage('Photo size should not exceed 5MB', 'error');
        return;
      }

      setPhoto(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
      showNotificationMessage('Photo uploaded successfully', 'success');
    }
  };
  
  const handleAddSection = () => {
    if (sectionInput.trim() === '') {
      showNotificationMessage('Please select a section to add', 'error');
      return;
    }
    
    // Check if section already exists
    if (sectionsTeaching.includes(sectionInput.trim())) {
      showNotificationMessage('This section is already added', 'info');
      setSectionInput('');
      return;
    }
    
    setSectionsTeaching([...sectionsTeaching, sectionInput.trim()]);
    setSectionInput('');
    showNotificationMessage('Section added successfully', 'success');
  };
  
  const handleRemoveSection = (sectionToRemove) => {
    setSectionsTeaching(sectionsTeaching.filter(section => section !== sectionToRemove));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Create form data for file upload
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('email', email.trim());
      formData.append('department', department);
      
      // Add each section as a separate field with the same name
      sectionsTeaching.forEach(section => {
        formData.append('sectionsTeaching', section);
      });
      
      formData.append('photo', photo);
      
      // Submit request to API
      const response = await axios.post(`${BACKEND_URL}/api/auth/faculty-request`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const successMessage = response.data.message || 'Your request has been submitted successfully. You will receive an email once approved.';
      setMessage(successMessage);
      showNotificationMessage(successMessage, 'success');
      
      // Reset form
      setName('');
      setEmail('');
      setDepartment('');
      setSectionsTeaching([]);
      setPhoto(null);
      setPhotoPreview(null);
      
      setTimeout(() => {
        navigate('/login');
      }, 5000);
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to submit request. Please try again.';
      setError(errorMessage);
      showNotificationMessage(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="faculty-request-container">
      {showNotification && (
        <div className={`notification-popup ${notificationType}`}>
          <div className="notification-icon">
            <i className={`fas ${notificationType === 'success' ? 'fa-check-circle' : notificationType === 'info' ? 'fa-info-circle' : 'fa-exclamation-circle'}`}></i>
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
      )}
      <div className="faculty-request-card">
        <h2>Faculty Account Request</h2>
        <p className="request-info">
          Fill out this form to request a faculty account. Your request will be reviewed by an administrator.
        </p>
        
        {message && (
          <div className="success-message">
            <p>{message}</p>
            <Link to="/login" className="back-to-login">Back to Login</Link>
          </div>
        )}
        
        {!message && (
          <form onSubmit={handleSubmit}>
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input 
                id="name"
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
                placeholder="Enter your full name"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input 
                id="email"
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                placeholder="Enter your email address"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="department">Department</label>
              <select 
                id="department"
                value={department} 
                onChange={(e) => setDepartment(e.target.value)} 
                required
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="sections">Sections You Teach</label>
              <div className="section-input-container">
                <select
                  id="sections"
                  value={sectionInput}
                  onChange={(e) => setSectionInput(e.target.value)}
                  className="form-select"
                >
                  <option value="">Select a section</option>
                  {availableSections.map(section => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
                <button 
                  type="button" 
                  className="add-section-btn"
                  onClick={handleAddSection}
                  disabled={!sectionInput}
                >
                  Add
                </button>
              </div>
              
              {sectionsTeaching.length > 0 && (
                <div className="sections-list">
                  {sectionsTeaching.map((section, index) => (
                    <div key={index} className="section-tag">
                      {section}
                      <button 
                        type="button"
                        className="remove-section-btn"
                        onClick={() => handleRemoveSection(section)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="field-help-text">Add all sections that you teach. You will only be able to manage attendance for these sections.</p>
            </div>
            
            <div className="form-group">
              <label htmlFor="photo">ID Card Photo</label>
              <div className="file-upload-container">
                <input 
                  id="photo"
                  type="file" 
                  accept="image/*" 
                  onChange={handlePhotoChange} 
                  required 
                  className="file-input"
                />
                <label htmlFor="photo" className="file-upload-label">
                  {photo ? 'Change Photo' : 'Choose Photo'}
                </label>
                {photoPreview && (
                  <div className="photo-preview">
                    <img src={photoPreview} alt="ID Card Preview" />
                  </div>
                )}
              </div>
              <p className="file-help-text">Upload a clear image of your faculty ID card</p>
            </div>
            
            <div className="form-actions">
              <button 
                type="submit" 
                className="submit-button" 
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
              <Link to="/login" className="cancel-link">Cancel</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default FacultyRequestForm;