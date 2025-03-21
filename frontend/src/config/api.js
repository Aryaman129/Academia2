const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  login: `${API_BASE_URL}/api/auth/login`,
  register: `${API_BASE_URL}/api/auth/register`,
  profile: `${API_BASE_URL}/api/profile`,
  attendance: `${API_BASE_URL}/api/attendance`,
  marks: `${API_BASE_URL}/api/marks`,
  timetable: `${API_BASE_URL}/api/timetable`,
  calendar: `${API_BASE_URL}/api/calendar`
};

export default API_BASE_URL; 