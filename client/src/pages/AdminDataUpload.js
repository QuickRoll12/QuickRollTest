import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import '../styles/AdminDataUpload.css';

const AdminDataUpload = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadStats, setUploadStats] = useState(null);
  const [fileName, setFileName] = useState('');

  // Handle file selection
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setError('');
    setSuccess('');
    setPreviewData([]);
    setUploadStats(null);

    // Check file type
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      setError('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setSelectedFile(file);
  };

  // Generate preview from the Excel file
  const handlePreview = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Read the file locally for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            setError('The Excel file is empty');
            setLoading(false);
            return;
          }

          // Check required fields
          const requiredFields = ['name', 'email', 'studentId', 'course', 'section', 'semester', 'classRollNumber', 'universityRollNumber'];
          const firstRow = jsonData[0];
          const missingFields = requiredFields.filter(field => !firstRow.hasOwnProperty(field));

          if (missingFields.length > 0) {
            setError(`Missing required fields: ${missingFields.join(', ')}`);
            setLoading(false);
            return;
          }

          setPreviewData(jsonData.slice(0, 5)); // Show first 5 records
          setTotalRecords(jsonData.length);
          setSuccess(`Preview generated successfully. Total records: ${jsonData.length}`);
        } catch (error) {
          setError('Error parsing Excel file: ' + error.message);
        } finally {
          setLoading(false);
        }
      };

      reader.onerror = () => {
        setError('Error reading file');
        setLoading(false);
      };

      reader.readAsArrayBuffer(selectedFile);
    } catch (error) {
      setError('Error generating preview: ' + error.message);
      setLoading(false);
    }
  };

  // Upload and process the Excel file
  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/admin/upload-student-data`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setUploadStats(response.data.stats);
      setSuccess('Student data processed successfully');
    } catch (error) {
      console.error('Upload error:', error);
      setError(
        error.response?.data?.message || 
        'Error uploading file. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-upload-container">
      <div className="admin-header">
        <h2>Student Data Upload</h2>
        <button 
          className="back-button" 
          onClick={() => navigate('/admin/dashboard')}
        >
          <i className="fas fa-arrow-left"></i> Back to Dashboard
        </button>
      </div>

      <div className="upload-card">
        <div className="upload-instructions">
          <h3>Instructions</h3>
          <p>Upload an Excel file (.xlsx or .xls) with the following student information:</p>
          <ul>
            <li><strong>name</strong> - Full name of the student</li>
            <li><strong>email</strong> - Email address (must be unique)</li>
            <li><strong>studentId</strong> - Student ID number</li>
            <li><strong>course</strong> - Course name</li>
            <li><strong>section</strong> - Section name</li>
            <li><strong>department</strong> - Semester</li>
            <li><strong>classRollNumber</strong> - Class roll number</li>
            <li><strong>universityRollNumber</strong> - University roll number</li>
            <li><strong>photo_url</strong> - URL to student's photo (optional)</li>
          </ul>
          <p>All students will be created with the role 'student' and will be required to change their password on first login.</p>
        </div>

        <div className="file-upload-section">
          <label className="file-input-label">
            <i className="fas fa-file-excel"></i>
            <span>Select Excel File</span>
            <input 
              type="file" 
              className="file-input" 
              accept=".xlsx, .xls" 
              onChange={handleFileChange} 
              disabled={loading}
            />
          </label>

          {fileName && (
            <div className="selected-file">
              <p><strong>Selected file:</strong> {fileName}</p>
              <div>
                <button 
                  className="preview-button" 
                  onClick={handlePreview} 
                  disabled={!selectedFile || loading}
                >
                  {loading ? 'Processing...' : 'Preview Data'}
                </button>
                <button 
                  className="upload-button" 
                  onClick={handleUpload} 
                  disabled={!selectedFile || loading || previewData.length === 0}
                >
                  {loading ? 'Processing...' : 'Upload Data'}
                </button>
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
        </div>

        {previewData.length > 0 && (
          <div className="preview-container">
            <h3>Data Preview</h3>
            <p>Showing {previewData.length} of {totalRecords} records</p>
            
            <div className="table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    {Object.keys(previewData[0]).map(key => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, index) => (
                    <tr key={index}>
                      {Object.values(row).map((value, i) => (
                        <td key={i}>{value}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {uploadStats && (
          <div className="upload-stats">
            <h3>Upload Results</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Total Records</span>
                <span className="stat-value">{uploadStats.totalRecords}</span>
              </div>
              <div className="stat-card success">
                <span className="stat-label">Successfully Added</span>
                <span className="stat-value">{uploadStats.successCount}</span>
              </div>
              <div className="stat-card error">
                <span className="stat-label">Errors</span>
                <span className="stat-value">{uploadStats.errorCount}</span>
              </div>
            </div>

            {uploadStats.errors && uploadStats.errors.length > 0 && (
              <div className="error-details">
                <h4>Error Details</h4>
                <ul>
                  {uploadStats.errors.map((error, index) => (
                    <li key={index}>
                      Row {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDataUpload;