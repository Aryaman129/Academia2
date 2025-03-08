"use client"
import React, { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import LoadingIndicator from "./LoadingIndicator"

// IMPORTANT: Define the API URL
const API_URL = "http://localhost:5050"

const Dashboard = () => {
  const [attendanceData, setAttendanceData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userEmail, setUserEmail] = useState("")
  const navigate = useNavigate()

  // Fetch attendance data (wrapped in useCallback to prevent useEffect issues)
  const fetchAttendance = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Get token from localStorage (set during login)
      const token = localStorage.getItem("token")
      const email = localStorage.getItem("userEmail")

      if (!token) {
        throw new Error("Authentication required. Please login again.")
      }

      setUserEmail(email || "User")

      console.log("Fetching attendance data...")

      const response = await axios.get(`${API_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      console.log("📌 Attendance API Response:", response.data)

      if (response.data.success) {
        setAttendanceData(response.data.attendance || [])
      } else {
        throw new Error(response.data.error || "No attendance records found.")
      }
    } catch (err) {
      console.error("Attendance fetch error:", err)

      if (err.response?.status === 401) {
        setError("Your session has expired. Please login again.")
        localStorage.removeItem("token")
        setTimeout(() => navigate("/"), 3000)
      } else {
        setError(err.message || "An error occurred while fetching attendance data.")
      }
    } finally {
      setLoading(false)
    }
  }, [navigate]) // Added `useCallback` to memoize fetchAttendance

  // Call fetchAttendance on component mount
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/")
      return
    }

    fetchAttendance()
  }, [fetchAttendance, navigate]) // Added `fetchAttendance` to dependency array

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("userEmail")
    localStorage.removeItem("userId")
    navigate("/")
  }

  const handleRefresh = () => {
    fetchAttendance()
  }

  if (loading) return <LoadingIndicator message="Fetching your attendance data..." />

  if (error)
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
        <button onClick={() => navigate("/")} className="bg-blue-500 text-white px-4 py-2 rounded-md">
          Back to Login
        </button>
      </div>
    )

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Attendance Dashboard</h1>
          <p className="text-gray-600">Welcome, {userEmail}</p>
        </div>
        <div>
          <button onClick={handleRefresh} className="bg-blue-500 text-white px-4 py-2 rounded-md mr-2">
            Refresh Data
          </button>
          <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-md">
            Logout
          </button>
        </div>
      </div>

      {attendanceData.length > 0 ? (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Faculty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hours Conducted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hours Absent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendance %
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceData.map((record, index) => (
                  <tr key={index} className={record.attendance_percentage < 75 ? "bg-red-100" : ""}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{record.course_code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{record.course_title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{record.faculty}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{record.hours_conducted}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{record.hours_absent}</td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                        record.attendance_percentage < 75 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {record.attendance_percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-medium">No attendance records found.</p>
          <p className="text-sm mt-1">This could be because:</p>
          <ul className="list-disc list-inside text-sm mt-1">
            <li>Your data is still being fetched from the system</li>
            <li>You haven't been registered for any courses yet</li>
            <li>There was an issue with the data scraping process</li>
          </ul>
          <div className="mt-4">
            <button onClick={handleRefresh} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded">
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard




