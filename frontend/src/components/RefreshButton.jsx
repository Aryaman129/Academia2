import React, { useState, useEffect } from 'react';
import './RefreshButton.css'; // We'll create this for styling
import axios from 'axios';

// Helper to get the API URL with protocol
const getApiUrl = () => {
  let apiUrl = process.env.REACT_APP_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  return apiUrl;
};

const RefreshButton = ({ onRefreshComplete }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  // Increase max wait time to 3 minutes (180 seconds)
  const MAX_WAIT_TIME = 180; 
  const CHECK_INTERVAL = 6; // Check every 6 seconds

  const loadLastUpdateTime = async () => {
    try {
      const token = localStorage.getItem('token');
      const email = localStorage.getItem('email');
      if (!token || !email) return;

      const apiUrl = getApiUrl();
      const response = await axios.get(`${apiUrl}/api/user-data?email=${email}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = response.data;
      if (data.attendance?.updated_at) {
        setLastUpdate(new Date(data.attendance.updated_at).toLocaleString());
      }
    } catch (err) {
      console.error('Error loading last update time:', err);
    }
  };

  // Initial load of update time
  useEffect(() => {
    loadLastUpdateTime();
  }, []);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      setProgress(0);
      setStatusMessage('Starting refresh...');
      
      const token = localStorage.getItem('token');
      const email = localStorage.getItem('email');
      
      if (!token || !email) {
        throw new Error('You need to log in first');
      }

      const apiUrl = getApiUrl();
      
      // First check if user has stored cookies
      const userDataResponse = await axios.get(`${apiUrl}/api/user-data?email=${email}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const userData = userDataResponse.data;
      if (!userData || !userData.cookies) {
        setStatusMessage('No stored credentials found. Please log in again.');
        throw new Error('No stored credentials found');
      }
      
      // Start the refresh process for attendance
      setStatusMessage('Refreshing attendance data...');
      const refreshResponse = await axios.post(`${apiUrl}/api/scrape`, 
        { email, cookies: userData.cookies },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (!refreshResponse.data.success) {
        throw new Error('Failed to start attendance refresh');
      }
      
      // Also start timetable scraping
      setStatusMessage('Refreshing timetable data...');
      await axios.post(`${apiUrl}/api/scrape-timetable`, 
        { email, cookies: userData.cookies },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      // Poll for updates
      let attempts = 0;
      const startTime = Date.now();
      
      const checkInterval = setInterval(async () => {
        attempts++;
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        
        // Update progress (capped at 95% until we confirm completion)
        const progressPercent = Math.min(95, Math.floor((elapsedSeconds / MAX_WAIT_TIME) * 100));
        setProgress(progressPercent);
        
        try {
          // Check if data has been updated
          const statusResponse = await axios.get(`${apiUrl}/api/user-data?email=${email}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const newData = statusResponse.data;
          
          // Check if attendance data is newer than when we started
          if (newData.attendance?.updated_at) {
            const updateTime = new Date(newData.attendance.updated_at);
            if (updateTime > new Date(startTime)) {
              // Success! Data has been updated
              clearInterval(checkInterval);
              setLastUpdate(updateTime.toLocaleString());
              setProgress(100);
              setStatusMessage('Data refresh complete!');
              setIsRefreshing(false);
              
              // Call the callback if provided
              if (onRefreshComplete) {
                onRefreshComplete();
              }
              return;
            }
          }
          
          // Update status message with more details as time passes
          if (elapsedSeconds > 60) {
            setStatusMessage(`Still refreshing... (${Math.floor(elapsedSeconds/60)}m ${elapsedSeconds%60}s)`);
          } else {
            setStatusMessage(`Refreshing... (${elapsedSeconds}s)`);
          }
          
          // Check if we've exceeded max wait time
          if (elapsedSeconds >= MAX_WAIT_TIME) {
            clearInterval(checkInterval);
            setStatusMessage('Refresh timed out, but data may still be updating in the background.');
            setIsRefreshing(false);
            // Still load the latest data we have
            loadLastUpdateTime();
          }
        } catch (err) {
          console.error('Error checking refresh status:', err);
          // Don't stop the interval yet, keep trying
        }
      }, CHECK_INTERVAL * 1000);
      
    } catch (err) {
      console.error('Refresh error:', err);
      setError(err.message || 'An error occurred during refresh');
      setIsRefreshing(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="refresh-container">
      <button 
        className={`refresh-button ${isRefreshing ? 'refreshing' : ''}`}
        onClick={handleRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        {isRefreshing && <div className="spinner"></div>}
      </button>
      
      {isRefreshing && (
        <div className="refresh-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{width: `${progress}%`}}
            ></div>
          </div>
          <div className="status-message">{statusMessage}</div>
        </div>
      )}
      
      {lastUpdate && <div className="last-update">Last updated: {lastUpdate}</div>}
      {error && <div className="error-message">Error: {error}</div>}
    </div>
  );
};

export default RefreshButton;