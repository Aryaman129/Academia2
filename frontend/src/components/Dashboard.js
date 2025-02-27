"use client"
import React from "react"
import { useState, useEffect } from "react"
import axios from "axios"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./utils/card.js"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./utils/tab.js"
import { useNavigate } from "react-router-dom"

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("profile")
  const [attendanceData, setAttendanceData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true)
      try {
        // Get user_id from localStorage
        const userId = localStorage.getItem("user_id")
        const token = localStorage.getItem("token")

        if (!userId || !token) {
          throw new Error("Authentication required. Please login again.")
        }

        // Set authorization header
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`

        // Fetch attendance using user_id
        const response = await axios.get(`http://localhost:5000/api/attendance?user_id=${userId}`)

        if (response.data.success) {
          setAttendanceData(response.data.attendance)
        } else {
          throw new Error(response.data.error || "Failed to fetch attendance data")
        }
      } catch (err) {
        console.error("Attendance fetch error:", err)
        setError(err.message || "An error occurred while fetching attendance data.")

        // If unauthorized, redirect to login
        if (err.response?.status === 401) {
          navigate("/")
        }
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [navigate])

  const handleLogout = () => {
    // Clear all stored data
    localStorage.clear()
    // Remove authorization header
    delete axios.defaults.headers.common["Authorization"]
    // Redirect to login
    navigate("/")
  }

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )

  if (error)
    return (
      <div className="text-center p-4">
        <div className="text-red-500 text-lg">{error}</div>
        <button
          onClick={() => navigate("/")}
          className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
        >
          Back to Login
        </button>
      </div>
    )

  return (
    <div className="container mx-auto p-4">
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile" onClick={() => setActiveTab("profile")}>
            Profile
          </TabsTrigger>
          <TabsTrigger value="attendance" onClick={() => setActiveTab("attendance")}>
            Attendance
          </TabsTrigger>
          <TabsTrigger value="settings" onClick={() => setActiveTab("settings")}>
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                <strong>Email:</strong> {localStorage.getItem("email") || "Not available"}
              </p>
              <p>
                <strong>Registration Number:</strong> {localStorage.getItem("registration_number") || "Not available"}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          {attendanceData && attendanceData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Attendance</CardTitle>
                <CardDescription>Your attendance records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {attendanceData.map((subject, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <h3 className="font-semibold text-lg">{subject.course_title}</h3>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm">
                          <span className="font-medium">Course Code:</span> {subject.course_code}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Category:</span> {subject.category}
                        </p>
                        {subject.faculty && (
                          <p className="text-sm">
                            <span className="font-medium">Faculty:</span> {subject.faculty}
                          </p>
                        )}
                        {subject.slot && (
                          <p className="text-sm">
                            <span className="font-medium">Slot:</span> {subject.slot}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">No attendance records found.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>Manage your account preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
              >
                Logout
              </button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Dashboard




