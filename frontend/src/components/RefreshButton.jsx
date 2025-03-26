import React, { useState, useEffect } from 'react';

const RefreshButton = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status, setStatus] = useState({
    lastUpdate: null,
    message: ''
  });

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
    </div>
  );
};

// Add some basic styles
const styles = `
.refresh-container {
  padding: 15px;
  border-radius: 8px;
  background: #f5f5f5;
}

.refresh-button {
  padding: 10px 20px;
  border-radius: 5px;
  border: none;
  background: #007bff;
  color: white;
  cursor: pointer;
}

.refresh-button:disabled {
  background: #ccc;
}

.status-message {
  margin-top: 10px;
  color: #666;
}

.last-update {
  margin-top: 5px;
  font-size: 0.9em;
  color: #888;
}
`;

export default RefreshButton; 