import React, { useState, useEffect } from 'react';

const RefreshButton = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status, setStatus] = useState({
    lastUpdate: null,
    message: ''
  });
  const [lastUpdate, setLastUpdate] = useState(null);

  const refreshData = async () => {
    setIsRefreshing(true);
    setStatus({ ...status, message: 'Starting refresh...' });
    
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/refresh-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setStatus({ ...status, message: 'Fetching new data...' });
      // Check status every 2 seconds
      const statusCheck = setInterval(async () => {
        const updated = await checkStatus();
        if (updated) {
          clearInterval(statusCheck);
          setIsRefreshing(false);
          setStatus({ 
            lastUpdate: updated.attendance_last_update,
            message: '✅ Data updated successfully!'
          });
        }
      }, 2000);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(statusCheck);
        setIsRefreshing(false);
        setStatus({ 
          ...status, 
          message: 'Update took too long, please try again' 
        });
      }, 30000);
      
    } catch (error) {
      console.error('Refresh failed:', error);
      setIsRefreshing(false);
      setStatus({ ...status, message: '❌ Update failed, please try again' });
    }
  };

  const checkStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/refresh-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Status check failed:', error);
      return null;
    }
  };

  // Check last update time
  const checkLastUpdate = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/refresh-status', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    
    if (data.success) {
      setLastUpdate({
        attendance: new Date(data.attendance_last_update).toLocaleString(),
        marks: new Date(data.marks_last_update).toLocaleString()
      });
    }
  };

  return (
    <div className="refresh-container">
      <button 
        onClick={refreshData} 
        disabled={isRefreshing}
        className={`refresh-button ${isRefreshing ? 'refreshing' : ''}`}
      >
        {isRefreshing ? '🔄 Updating...' : '🔄 Refresh Data'}
      </button>
      
      {status.message && (
        <div className="status-message">
          {status.message}
        </div>
      )}
      
      {status.lastUpdate && (
        <div className="last-update">
          Last updated: {new Date(status.lastUpdate).toLocaleString()}
        </div>
      )}

      {lastUpdate && (
        <div>
          <p>Last Attendance Update: {lastUpdate.attendance}</p>
          <p>Last Marks Update: {lastUpdate.marks}</p>
        </div>
      )}
    </div>
  );
};

// Add some basic styles
const styles = `