import React, { useState, useEffect } from 'react';

const RefreshButton = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const checkStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://academia2-1.onrender.com/api/refresh-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setLastUpdate({
          attendance: data.attendance_last_update,
          marks: data.marks_last_update
        });
      } else {
        console.error('Status check failed:', data.error);
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('https://academia2-1.onrender.com/api/refresh-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Wait a bit for data to update
      setTimeout(async () => {
        await checkStatus();
        setIsRefreshing(false);
      }, 5000);
      
    } catch (error) {
      console.error('Refresh failed:', error);
      setIsRefreshing(false);
    }
  };

  // Check status when component mounts
  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="refresh-container">
      <button 
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={`refresh-button ${isRefreshing ? 'refreshing' : ''}`}
      >
        {isRefreshing ? '🔄 Updating...' : '🔄 Refresh Data'}
      </button>
      
      {lastUpdate && (
        <div className="last-update-container">
          <div className="update-item">
            <span className="update-label">Attendance:</span>
            <span className="update-time">
              {lastUpdate.attendance ? new Date(lastUpdate.attendance).toLocaleString() : 'Not updated'}
            </span>
          </div>
          <div className="update-item">
            <span className="update-label">Marks:</span>
            <span className="update-time">
              {lastUpdate.marks ? new Date(lastUpdate.marks).toLocaleString() : 'Not updated'}
            </span>
          </div>
        </div>
      )}

      <style jsx>{`
        .refresh-container {
          padding: 15px;
          border-radius: 8px;
          background: #f5f5f5;
          margin: 10px;
        }

        .refresh-button {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: none;
          background: #007bff;
          color: white;
          font-size: 16px;
          cursor: pointer;
          margin-bottom: 15px;
        }

        .refresh-button:disabled {
          background: #ccc;
        }

        .last-update-container {
          background: white;
          border-radius: 8px;
          padding: 10px;
          margin-top: 10px;
        }

        .update-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }

        .update-item:last-child {
          border-bottom: none;
        }

        .update-label {
          font-weight: bold;
          color: #666;
        }

        .update-time {
          color: #333;
        }

        /* Mobile-specific styles */
        @media (max-width: 768px) {
          .refresh-container {
            padding: 10px;
            margin: 5px;
          }

          .update-item {
            flex-direction: column;
            gap: 4px;
          }

          .update-time {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
};

export default RefreshButton;