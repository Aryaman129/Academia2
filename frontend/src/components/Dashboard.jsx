"use client"
import React from "react"
import { useState, useEffect } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"

const API_URL = "http://localhost:5000"

const Dashboard = () => {
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token")
    const userData = localStorage.getItem("user")

    if (!token || !userData) {
      navigate("/login")
      return
    }

    setUser(JSON.parse(userData))
    fetchAttendance()
  }, [navigate])

  const fetchAttendance = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")

      const response = await axios.get(`${API_URL}/api/attendance`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.data.success) {
        setAttendance(response.data.attendance)
      } else {
        setError(response.data.error || "Failed to fetch attendance data")
      }
    } catch (err) {
      console.error("Error fetching attendance:", err)
      setError(err.response?.data?.error || "An error occurred while fetching attendance data")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    navigate("/login")
  }

  const refreshData = () => {
    fetchAttendance()
  }

  return (
    <div className="max-w-6xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Attendance Dashboard</h2>
        <div className="flex space-x-4">
          <button
            onClick={refreshData}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh Data"}
          </button>
          <button onClick={handleLogout} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
            Logout
          </button>
        </div>
      </div>

      {user && (
        <div className="mb-6 p-4 bg-gray-100 rounded">
          <p>
            <strong>Email:</strong> {user.email}
          </p>
          <p>
            <strong>Registration Number:</strong> {user.registration_number || "N/A"}
          </p>
        </div>
      )}

      {error && <div className="mb-6 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-2">Loading attendance data...</p>
        </div>
      ) : attendance.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left">Course Code</th>
                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left">Course Title</th>
                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-center">Hours Conducted</th>
                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-center">Hours Absent</th>
                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-center">Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((record, index) => (
                <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="py-2 px-4 border-b border-gray-200">{record.course_code}</td>
                  <td className="py-2 px-4 border-b border-gray-200">{record.course_title}</td>
                  <td className="py-2 px-4 border-b border-gray-200 text-center">{record.hours_conducted}</td>
                  <td className="py-2 px-4 border-b border-gray-200 text-center">{record.hours_absent}</td>
                  <td
                    className={`py-2 px-4 border-b border-gray-200 text-center font-medium ${
                      record.attendance_percentage >= 75 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {record.attendance_percentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded">
          <p className="text-gray-500">No attendance data available. Please check back later.</p>
          <p className="text-sm text-gray-400 mt-2">
            Note: It may take a few minutes for the attendance data to be scraped and stored.
          </p>
        </div>
      )}
    </div>
  )
}

export default Dashboard

