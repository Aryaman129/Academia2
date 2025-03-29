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
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  
  const fetchUserData = async (forceReload = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const email = localStorage.getItem('email');
      
      if (!token || !email) {
        throw new Error('Authentication required');
      }
      
      const apiUrl = getApiUrl();
      // Add a cache-busting parameter when forced reload is requested
      const cacheParam = forceReload ? `?t=${Date.now()}` : '';
      const response = await axios.get(`${apiUrl}/api/user-data?email=${email}${cacheParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setUserData(response.data);
      setLastRefreshTime(new Date());
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
    // Refresh the user data to show the latest with forced cache reload
    fetchUserData(true);
  };
  
  // Handler for manual data reload as fallback
  const handleManualReload = () => {
    fetchUserData(true);
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Academia Dashboard</h1>
        <p className="user-email">{localStorage.getItem('email')}</p>
      </div>
      
      <div className="refresh-section">
        <RefreshButton onRefreshComplete={handleRefreshComplete} />
        {lastRefreshTime && (
          <p className="last-reload">
            Data loaded: {lastRefreshTime.toLocaleTimeString()} 
            <button 
              onClick={handleManualReload} 
              className="manual-reload-btn"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Reload Now'}
            </button>
          </p>
        )}
      </div>
      
      {loading ? (
        <div className="loading-indicator">Loading your data...</div>
      ) : error ? (
        <div className="error-message">
          {error}
          <button onClick={handleManualReload} className="retry-btn">Try Again</button>
        </div>
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