import axios from 'axios';

// Ensure API URL is absolute and includes protocol
const getApiUrl = () => {
  let apiUrl = process.env.REACT_APP_API_URL || '';
  
  // Add protocol if missing
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  
  console.log('Final API URL:', apiUrl);
  return apiUrl;
};

const apiClient = axios.create({
  baseURL: getApiUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Rest of your API service code... 