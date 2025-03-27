import React from 'react';
import RefreshButton from '../components/RefreshButton';

const Dashboard = () => {
  return (
    <div className="dashboard">
      <h1>Your Dashboard</h1>
      
      {/* Add the refresh button here */}
      <RefreshButton />

      {/* Rest of your dashboard content */}
    </div>
  );
};

export default Dashboard; 