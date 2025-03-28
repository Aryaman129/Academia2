import React from 'react';

function EnvDebug() {
  // Only show in development
  if (process.env.REACT_APP_ENV !== 'development') {
    return null;
  }
  
  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '10px', 
      right: '10px', 
      background: '#f0f0f0', 
      padding: '10px', 
      border: '1px solid #ccc',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 1000
    }}>
      <h4>Environment Configuration</h4>
      <p>API URL: {process.env.REACT_APP_API_URL}</p>
      <p>Environment: {process.env.REACT_APP_ENV}</p>
    </div>
  );
}

export default EnvDebug; 