import React, { useState, useEffect } from 'react';
import './RefreshButton.css'; // We'll create this for styling

const RefreshButton = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      
      // Start refresh
      const token = localStorage.getItem('token');
      const response = await fetch('/api/refresh-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Refresh failed to start');
      
      // Check status every 5 seconds
      let attempts = 0;
      const checkStatus = async () => {
        const statusRes = await fetch('/api/refresh-status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const { attendance_last_update } = await statusRes.json();
        return attendance_last_update;
      };

      while (attempts < 30) {
        const updateTime = await checkStatus();
        if (updateTime) {
          setLastUpdate(new Date(updateTime).toLocaleString());
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load initial update time
  useEffect(() => {
    const loadInitialTime = async () => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/refresh-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const { attendance_last_update } = await response.json();
      if (attendance_last_update) {
        setLastUpdate(new Date(attendance_last_update).toLocaleString());
      }
    };
    loadInitialTime();
  }, []);

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
      
      {lastUpdate && <div className="last-update">Last updated: {lastUpdate}</div>}
      {error && <div className="error-message">Error: {error}</div>}
    </div>
  );
};

export default RefreshButton;