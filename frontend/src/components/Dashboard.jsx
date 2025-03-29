import React, { useState, useEffect } from 'react';
import RefreshButton from './RefreshButton';
import Attendance from './Attendance';
import Marks from './Marks';
import Timetable from './Timetable';
import axios from 'axios';
import './Dashboard.css';

// Helper to get API URL with protocol
const getApiUrl = () => {
  let apiUrl = process.env.REACT_APP_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  return apiUrl;
};

const Dashboard = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const email = localStorage.getItem('email');
      
      if (!token || !email) {
        throw new Error('Authentication required');
      }
      
      const apiUrl = getApiUrl();
      const response = await axios.get(`${apiUrl}/api/user-data?email=${email}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setUserData(response.data);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  
  // Load data on initial mount
  useEffect(() => {
    fetchUserData();
  }, []);
  
  // Handler for refresh button completion
  const handleRefreshComplete = () => {
    // Refresh the user data to show the latest
    fetchUserData();
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Academia Dashboard</h1>
        <p className="user-email">{localStorage.getItem('email')}</p>
      </div>
      
      <div className="refresh-section">
        <RefreshButton onRefreshComplete={handleRefreshComplete} />
      </div>
      
      {loading ? (
        <div className="loading-indicator">Loading your data...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div className="dashboard-content">
          <div className="dashboard-section">
            <h2>Attendance</h2>
            <Attendance data={userData?.attendance?.attendance_data} />
          </div>
          
          <div className="dashboard-section">
            <h2>Marks</h2>
            <Marks data={userData?.marks?.marks_data} />
          </div>
          
          <div className="dashboard-section">
            <h2>Timetable</h2>
            <Timetable data={userData?.timetable?.timetable_data} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 