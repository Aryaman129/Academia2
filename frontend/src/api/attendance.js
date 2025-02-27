import axios from 'axios';

// Adjust the baseURL to match your backend server (use localhost for testing)
const API = axios.create({
  baseURL: 'http://127.0.0.1:5000'
});

// Function to get attendance data for a given user registration number
export const getAttendanceData = async (userId) => {
  try {
    const response = await API.get('/api/attendance', {
      params: { user_id: userId }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching attendance data", error);
    throw error;
  }
};
