import React, { useState, useEffect } from 'react';
import API from '../services/api';

function RefreshButton() {
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  // Check status on component mount
  useEffect(() => {
    checkStatus();
    // Set up interval to check status every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Function to check refresh status
  const checkStatus = async () => {
    try {
      // Get attendance data to check its last update time
      const attendanceResponse = await API.getAttendance();
      if (attendanceResponse.data && attendanceResponse.data.success) {
        const attendanceData = attendanceResponse.data.attendance;
        if (attendanceData && attendanceData.last_updated) {
          setLastUpdated(new Date(attendanceData.last_updated));
        }
      }
      
      // Also check if a refresh is in progress
      const statusResponse = await API.checkRefreshStatus();
      if (statusResponse.data && statusResponse.data.success) {
        const status = statusResponse.data.status;
        if (status === 'running') {
          setRefreshing(true);
          // If a refresh is running, poll more frequently
          setTimeout(checkStatus, 5000);
        } else {
          setRefreshing(false);
        }
      }
    } catch (err) {
      console.error('Error checking refresh status:', err);
      setError('Failed to check status');
      setRefreshing(false);
    }
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    if (refreshing) return; // Prevent multiple refreshes
    
    setRefreshing(true);
    setError(null);
    
    try {
      console.log('Starting refresh process...');
      
      // Call the refresh endpoint
      const response = await API.refreshData();
      
      if (response.data && response.data.success) {
        console.log('Refresh process started successfully');
        
        // Start polling for status
        let completed = false;
        let attempts = 0;
        
        const checkCompletion = async () => {
          if (completed || attempts > 60) return; // Timeout after ~5 minutes
          
          attempts++;
          try {
            const statusResponse = await API.checkRefreshStatus();
            const status = statusResponse.data.status;
            
            if (status === 'completed') {
              completed = true;
              setRefreshing(false);
              checkStatus(); // Update the last updated time
              console.log('Refresh completed successfully');
            } else if (status === 'failed') {
              completed = true;
              setRefreshing(false);
              setError('Refresh failed. Please try again.');
              console.error('Refresh failed');
            } else {
              // Still running, check again in 5 seconds
              setTimeout(checkCompletion, 5000);
            }
          } catch (err) {
            console.error('Error checking refresh status:', err);
            setTimeout(checkCompletion, 5000);
          }
        };
        
        // Start the polling process
        setTimeout(checkCompletion, 5000);
      } else {
        throw new Error('Refresh process failed to start');
      }
    } catch (err) {
      console.error('Error starting refresh:', err);
      setError(err.message || 'Failed to refresh data');
      setRefreshing(false);
    }
  };

  // Format last updated time
  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Never';
    
    // Format as relative time (e.g., "2 hours ago")
    const now = new Date();
    const diffMs = now - lastUpdated;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  return (
    <div className="refresh-container">
      <button 
        className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
        onClick={handleRefresh}
        disabled={refreshing}
      >
        {refreshing ? 'Refreshing...' : 'Refresh Data'}
      </button>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="last-updated">
        Last updated: {formatLastUpdated()}
      </div>
    </div>
  );
}

export default RefreshButton; 