import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AdminManageFacultyAssignments.css';

// Use environment variable directly instead of importing from config
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

const AdminManageFacultyAssignments = () => {
  const [loading, setLoading] = useState(true);
  const [faculties, setFaculties] = useState([]);
  const [departments] = useState(['BTech', 'BCA', 'BCom', 'BBA', 'Law', 'MCA', 'MBA', 'BPharm', 'BSc']);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [newAssignment, setNewAssignment] = useState({ semester: '', section: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const navigate = useNavigate();

  // Fetch departments and faculties on component mount
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (!token || user.role !== 'admin') {
        navigate('/admin/login');
      }
    };
    
    checkAuth();
    // No need to fetch departments as they are hardcoded
    setLoading(false);
  }, [navigate]);

  // Fetch faculties when department changes
  useEffect(() => {
    if (selectedDepartment) {
      fetchFaculties(selectedDepartment);
    } else {
      setFaculties([]);
    }
  }, [selectedDepartment]);

  // Removed fetchDepartments function as we're using hardcoded departments

  const fetchFaculties = async (department) => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/admin/faculties?department=${department}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch faculties');
      }
      
      const data = await response.json();
      setFaculties(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching faculties:', error);
      setError('Failed to load faculties. Please try again.');
      setLoading(false);
    }
  };

  const handleDepartmentChange = (e) => {
    setSelectedDepartment(e.target.value);
    setSelectedFaculty(null);
  };

  const handleFacultySelect = (faculty) => {
    setSelectedFaculty(faculty);
    setNewAssignment({ semester: '', section: '' });
    setError('');
    setSuccess('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewAssignment(prev => ({ ...prev, [name]: value }));
  };

  const handleAddAssignment = async () => {
    // Validate inputs
    if (!newAssignment.semester || !newAssignment.section) {
      setError('Please enter both semester and section');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/faculty/${selectedFaculty._id}/assignment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newAssignment)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add assignment');
      }

      const updatedFaculty = await response.json();
      
      // Update the faculty in the list
      setFaculties(faculties.map(f => 
        f._id === updatedFaculty._id ? updatedFaculty : f
      ));
      
      // Update selected faculty
      setSelectedFaculty(updatedFaculty);
      
      // Reset form
      setNewAssignment({ semester: '', section: '' });
      setSuccess('Assignment added successfully');
      setError('');
    } catch (error) {
      console.error('Error adding assignment:', error);
      setError(error.message || 'Failed to add assignment. Please try again.');
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/faculty/${selectedFaculty._id}/assignment/${assignmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to remove assignment');
      }

      const updatedFaculty = await response.json();
      
      // Update the faculty in the list
      setFaculties(faculties.map(f => 
        f._id === updatedFaculty._id ? updatedFaculty : f
      ));
      
      // Update selected faculty
      setSelectedFaculty(updatedFaculty);
      
      setSuccess('Assignment removed successfully');
      setError('');
    } catch (error) {
      console.error('Error removing assignment:', error);
      setError(error.message || 'Failed to remove assignment. Please try again.');
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredFaculties = faculties.filter(faculty => 
    faculty.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faculty.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="manage-faculty-container">
      <div className="header">
        <h1>Manage Faculty Assignments</h1>
        <button onClick={() => navigate('/admin/dashboard')} className="back-button">
          <i className="fas fa-arrow-left"></i> Back to Dashboard
        </button>
      </div>

      <div className="filters-container">
        <div className="filter-group">
          <label>Department:</label>
          <select 
            value={selectedDepartment} 
            onChange={handleDepartmentChange}
            className="department-select"
          >
            <option value="">Select Department</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        {selectedDepartment && (
          <div className="filter-group">
            <label>Search Faculty:</label>
            <input
              type="text"
              placeholder="Search by name or email"
              value={searchTerm}
              onChange={handleSearchChange}
              className="search-input"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : error && !selectedFaculty ? (
        <div className="error-message">{error}</div>
      ) : (
        <div className="content-container">
          {selectedDepartment && (
            <div className="faculty-list-container">
              <h2>Faculty Members - {selectedDepartment}</h2>
              {filteredFaculties.length === 0 ? (
                <p className="no-results">No faculty members found in this department</p>
              ) : (
                <div className="faculty-cards">
                  {filteredFaculties.map(faculty => (
                    <div 
                      key={faculty._id} 
                      className={`faculty-card ${selectedFaculty && selectedFaculty._id === faculty._id ? 'selected' : ''}`}
                      onClick={() => handleFacultySelect(faculty)}
                    >
                      <div className="faculty-info">
                        <h3>{faculty.name}</h3>
                        <p><i className="fas fa-envelope"></i> {faculty.email}</p>
                        <p><i className="fas fa-id-badge"></i> {faculty.employeeId || 'No ID'}</p>
                      </div>
                      <div className="assignment-count">
                        <span className="count">{faculty.teachingAssignments.length}</span>
                        <span className="label">Assignments</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedFaculty && (
            <div className="assignments-container">
              <h2>Assignments for {selectedFaculty.name}</h2>
              
              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}
              
              <div className="current-assignments">
                <h3>Current Assignments</h3>
                {selectedFaculty.teachingAssignments.length === 0 ? (
                  <p>No teaching assignments</p>
                ) : (
                  <table className="assignments-table">
                    <thead>
                      <tr>
                        <th>Semester</th>
                        <th>Section</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedFaculty.teachingAssignments.map((assignment, index) => (
                        <tr key={index}>
                          <td>{assignment.semester}</td>
                          <td>{assignment.section}</td>
                          <td>
                            <button 
                              className="remove-btn"
                              onClick={() => handleRemoveAssignment(assignment._id)}
                            >
                              <i className="fas fa-trash"></i> Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              
              <div className="add-assignment">
                <h3>Add New Assignment</h3>
                <div className="assignment-form">
                  <div className="form-group">
                    <label>Semester:</label>
                    <input
                      type="text"
                      name="semester"
                      placeholder="e.g., 1st, 2nd, 3rd"
                      value={newAssignment.semester}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Section:</label>
                    <input
                      type="text"
                      name="section"
                      placeholder="e.g., A, B, C"
                      value={newAssignment.section}
                      onChange={handleInputChange}
                    />
                  </div>
                  <button 
                    className="add-btn"
                    onClick={handleAddAssignment}
                  >
                    <i className="fas fa-plus"></i> Add Assignment
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminManageFacultyAssignments;
