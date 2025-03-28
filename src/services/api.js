import axios from 'axios';

// Create a base axios instance with the API URL from environment
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add request interceptor to attach auth token to every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle token expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 errors (unauthorized - token expired)
    if (error.response && error.response.status === 401) {
      // Clear invalid token
      localStorage.removeItem('token');
      
      // Redirect to login page
      window.location.href = '/login';
      return Promise.reject(new Error('Your session has expired. Please log in again.'));
    }
    return Promise.reject(error);
  }
);

// Define API methods
const API = {
  // Auth endpoints
  login: (email, password) => {
    return apiClient.post('/api/login', { email, password });
  },
  
  // Data endpoints
  getAttendance: () => {
    return apiClient.get('/api/attendance');
  },
  
  getMarks: () => {
    return apiClient.get('/api/marks');
  },
  
  getTimetable: () => {
    return apiClient.get('/api/timetable');
  },
  
  // Refresh endpoints
  refreshData: () => {
    return apiClient.post('/api/refresh-data');
  },
  
  checkRefreshStatus: () => {
    return apiClient.get('/api/refresh-status');
  },
  
  // Health check
  checkHealth: () => {
    return apiClient.get('/health');
  },
  
  // Scraper health
  checkScraperHealth: () => {
    return apiClient.get('/api/scraper-health');
  }
};

export default API; 