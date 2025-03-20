import axios from "axios"

// API base URL - configurable for different environments
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050"

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000, // 60 seconds timeout for long-running operations
})

// Add request interceptor to include auth token in all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Add response interceptor to handle common errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle authentication errors
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem("token")
      localStorage.removeItem("userEmail")
      window.location.href = "/"
    }
    return Promise.reject(error)
  },
)

// API endpoints
export const authAPI = {
  login: (email: string, password: string) => apiClient.post("/api/login", { email, password }),
  register: (email: string, password: string) => apiClient.post("/api/register", { email, password }),
}

export const dataAPI = {
  getAttendance: () => apiClient.get("/api/attendance"),
  getTimetable: () => apiClient.get("/api/timetable"),
  refreshTimetable: (password: string) => apiClient.post("/api/timetable", { password }),
  getTimetableStatus: () => apiClient.get("/api/timetable-status"),
  getMarks: () => apiClient.get("/api/marks"),
  getScraperStatus: () => apiClient.get("/api/scraper-status"),
}

export default apiClient

