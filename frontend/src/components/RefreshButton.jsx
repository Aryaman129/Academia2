import React, { useState, useEffect } from 'react';

const RefreshButton = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const checkStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log("🔍 Checking status with token:", token?.substring(0, 10) + "...");
      
      const response = await fetch('https://academia2-1.onrender.com/api/refresh-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      console.log("📊 Status response:", data);
      
      if (data.success) {
        console.log("✅ Update times:", {
          attendance: new Date(data.attendance_last_update).toLocaleString(),
          marks: new Date(data.marks_last_update).toLocaleString()
        });
        setLastUpdate({
          attendance: data.attendance_last_update,
          marks: data.marks_last_update
        });
        setError(null);
      } else {
        console.error('❌ Status check failed:', data.error);
        setError(data.error);
      }
    } catch (error) {
      console.error('❌ Error checking status:', error);
      setError('Failed to check status');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    console.log("🔄 Starting refresh...");
    
    try {
      const token = localStorage.getItem('token');
      console.log("🔑 Using token:", token?.substring(0, 10) + "...");
      
      const response = await fetch('https://academia2-1.onrender.com/api/refresh-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      console.log("📡 Refresh response:", data);
      
      if (data.success) {
        console.log("✅ Refresh started, checking status...");
        // Check status every 5 seconds for up to 1 minute
        let attempts = 0;
        const maxAttempts = 12;
        
        const checkInterval = setInterval(async () => {
          attempts++;
          console.log(`🔄 Status check attempt ${attempts}/${maxAttempts}`);
          await checkStatus();
          
          if (attempts >= maxAttempts) {
            console.log("⏱️ Max attempts reached, stopping checks");
            clearInterval(checkInterval);
            setIsRefreshing(false);
          }
        }, 5000);
      } else {
        console.error("❌ Refresh failed:", data.error);
        setError(data.error);
        setIsRefreshing(false);
      }
    } catch (error) {
      console.error('❌ Refresh failed:', error);
      setError('Failed to refresh data');
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
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {lastUpdate && (
        <div className="last-update-container">
          <div className="update-item">
            <span className="update-label">Last Updated:</span>
            <span className="update-time">
              {lastUpdate.attendance ? 
                new Date(lastUpdate.attendance).toLocaleString() : 
                'Not yet updated'}
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

        .error-message {
          color: red;
          margin: 10px 0;
          padding: 10px;
          background: #fff;
          border-radius: 8px;
          border: 1px solid red;
        }
      `}</style>
    </div>
  );
};

export default RefreshButton;