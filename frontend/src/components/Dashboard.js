"use client"
import React, { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import LoadingIndicator from "./LoadingIndicator"
import './Dashboard.css';
import AttendancePredictionModal from './AttendancePredictionModal';

const API_URL = "http://localhost:5050"

const Dashboard = () => {
  // State management
  const [attendanceData, setAttendanceData] = useState([])
  const [timetableData, setTimetableData] = useState({})
  const [batch, setBatch] = useState("")
  const [personalDetails, setPersonalDetails] = useState({})
  const [marksData, setMarksData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userEmail, setUserEmail] = useState("")
  const [currentDay, setCurrentDay] = useState(3)
  const [isPredictionModalOpen, setIsPredictionModalOpen] = useState(false)
  const navigate = useNavigate()

  const handleDayChange = (newDay) => {
    if (newDay >= 1 && newDay <= 5) {
      setCurrentDay(newDay)
    }
  }

  // Fetch attendance data
  const fetchAttendance = useCallback(async () => {
    try {
      const token = localStorage.getItem("token")
      const email = localStorage.getItem("userEmail")
      if (!token) throw new Error("Authentication required. Please login again.")
      setUserEmail(email || "User")
      console.log("Fetching attendance data...")
      const response = await axios.get(`${API_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      console.log("📌 Attendance API Response:", response.data)
      if (response.data.success) {
        const records = response.data.attendance.records || [];
        setAttendanceData(records);
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
    }
  }, [navigate])

  // Fetch timetable data
  const fetchTimetable = useCallback(async () => {
    try {
      const token = localStorage.getItem("token")
      const password = localStorage.getItem("userPassword") || ""
      if (!token) throw new Error("Authentication required. Please login again.")
      console.log("Fetching timetable data...")
      const response = await axios.get(`${API_URL}/api/timetable`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { password: password }
      })
      console.log("📌 Timetable API Response:", response.data)
      if (response.data.success) {
        setTimetableData(response.data.timetable || {})
        setBatch(response.data.batch || "")
        setPersonalDetails(response.data.personal_details || {})
      } else {
        throw new Error(response.data.error || "No timetable records found.")
      }
    } catch (err) {
      console.error("Timetable fetch error:", err)
      setError(err.message || "An error occurred while fetching timetable data.")
    }
  }, [])

  // Fetch marks data
  const fetchMarks = useCallback(async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) throw new Error("Authentication required. Please login again.")
      console.log("Fetching marks data...")
      const response = await axios.get(`${API_URL}/api/marks`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      console.log("📌 Marks API Response:", response.data)
      if (response.data.success) {
        setMarksData(response.data.marks || {})
      } else {
        throw new Error(response.data.error || "No marks records found.")
      }
    } catch (err) {
      console.error("Marks fetch error:", err)
      setError(err.message || "An error occurred while fetching marks data.")
    }
  }, [])

  // Fetch all data on mount
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/")
      return
    }
    Promise.all([fetchTimetable(), fetchAttendance(), fetchMarks()]).then(() => setLoading(false))
  }, [fetchAttendance, fetchTimetable, fetchMarks, navigate])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("userEmail")
    localStorage.removeItem("userId")
    navigate("/")
  }

  const handleRefresh = () => {
    setLoading(true)
    Promise.all([fetchTimetable(), fetchAttendance(), fetchMarks()]).then(() => setLoading(false))
  }

  const getSlotColor = (slot) => {
    if (!slot || !slot.courses || slot.courses.length === 0) return "bg-[#1E2A1E]"
    return slot.courses[0].type?.toLowerCase().includes("practical") ? "bg-[#4CAF50]" : "bg-[#FFD700]/20"
  }

  if (loading) return <LoadingIndicator message="Fetching your data..." />

  if (error)
    return (
      <div className="min-h-screen bg-[#0D1117] text-gray-100 p-4">
        <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4">
          <strong>Error:</strong> {error}
        </div>
        <button onClick={() => navigate("/")} className="bg-blue-500/20 text-blue-400 px-4 py-2 rounded-lg">
          Back to Login
        </button>
      </div>
    )

  return (
    <div className="min-h-screen bg-[#0D1117] text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#0D1117] py-4 px-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-400">{userEmail}</p>
          <div className="flex gap-2">
            <button onClick={handleRefresh} className="px-3 py-1 text-sm border border-gray-700 rounded">
              Refresh
            </button>
            <button onClick={handleLogout} className="px-3 py-1 text-sm border border-gray-700 rounded">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Timetable Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium">Timetable</h2>
            <div className="flex items-center gap-4">
              <button className="text-gray-400 hover:text-white">Download</button>
              <button className="text-gray-400 hover:text-white">ⓘ</button>
            </div>
          </div>
          <div className="space-y-1">
            {Object.entries(timetableData[`Day ${currentDay}`] || {})
              .sort(([a], [b]) => {
                // Parse time to 24-hour format for proper sorting
                const parseTime = (time) => {
                  const [hours, minutes] = time.split(":").map(Number);
                  let totalMinutes = hours * 60 + minutes;
                  // Convert 12-hour format to 24-hour format
                  if (hours < 8) totalMinutes += 12 * 60; // Afternoon times
                  return totalMinutes;
                };
                
                const timeA = parseTime(a.split("-")[0].trim());
                const timeB = parseTime(b.split("-")[0].trim());
                return timeA - timeB;
              })
              .map(([timeSlot, slotInfo]) => (
                <div
                  key={timeSlot}
                  className={`${getSlotColor(slotInfo)} p-4 rounded-lg`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      {slotInfo.courses && slotInfo.courses.length > 0 ? (
                        slotInfo.courses.map((course, idx) => (
                          <div key={idx} className="text-sm font-medium">
                            {course.title}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm opacity-60">No class scheduled</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 ml-4 font-medium">{timeSlot}</div>
                  </div>
                </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-4">
            <button 
              onClick={() => handleDayChange(currentDay - 1)}
              disabled={currentDay <= 1}
              className="text-gray-400 hover:text-white disabled:opacity-50"
            >
              ← Day {currentDay - 1}
            </button>
            <button 
              onClick={() => handleDayChange(3)} 
              className="px-4 py-2 bg-gray-800 rounded-lg text-sm"
            >
              Today
            </button>
            <button 
              onClick={() => handleDayChange(currentDay + 1)}
              disabled={currentDay >= 5}
              className="text-gray-400 hover:text-white disabled:opacity-50"
            >
              Day {currentDay + 1} →
            </button>
          </div>
        </div>

        {/* Attendance Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium">Attendance</h2>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsPredictionModalOpen(true)} 
                className="text-gray-400 hover:text-white"
              >
                Predict
              </button>
              <button className="text-gray-400 hover:text-white">ⓘ</button>
            </div>
          </div>
          <div className="space-y-2">
            {attendanceData.map((record, index) => (
              <div key={index} className="bg-[#1A1F26] rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-yellow-400">✦</span>
                    <div>
                      <div className="font-medium">{record.course_title}</div>
                      <div className="text-sm text-gray-400">
                        {(() => {
                          // Get current attendance numbers
                          const totalClasses = record.hours_conducted;
                          const presentClasses = record.hours_conducted - record.hours_absent;
                          const currentPercentage = (presentClasses / totalClasses) * 100;
                          
                          if (currentPercentage < 75) {
                            // Calculate required classes to reach 75%
                            let requiredClasses = 0;
                            let tempTotal = totalClasses;
                            let tempPresent = presentClasses;
                            
                            while ((tempPresent / tempTotal) * 100 < 75) {
                              tempPresent++;
                              tempTotal++;
                              requiredClasses++;
                            }
                            
                            return `Required: ${requiredClasses} ${requiredClasses === 1 ? 'class' : 'classes'}`;
                          } else {
                            // Calculate margin (how many classes can be missed while staying above 75%)
                            const minRequired = Math.ceil(totalClasses * 0.75);
                            const margin = presentClasses - minRequired;
                            
                            return `Margin: ${margin} ${margin === 1 ? 'class' : 'classes'}`;
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <span className="text-green-400 text-sm">{record.hours_conducted - record.hours_absent}</span>
                      <span className="text-red-400 text-sm">{record.hours_absent}</span>
                      <span className="bg-gray-700 px-2 py-1 rounded text-xs">
                        {record.hours_conducted}
                      </span>
                    </div>
                    <div className="text-green-400 font-medium w-16 text-right">
                      {record.attendance_percentage}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Marks Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium">Marks</h2>
            <div className="flex items-center gap-4">
              <button className="text-gray-400 hover:text-white">Predict</button>
              <button className="text-gray-400 hover:text-white">ⓘ</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marksData.records?.filter(record => {
              // Filter out header rows and duplicates
              const name = record.course_name?.trim().toLowerCase();
              return name && 
                     name !== 'semester:' && 
                     name !== 'course title' &&
                     record.tests?.some(test => 
                       test.obtained_marks !== undefined || 
                       test.max_marks !== undefined ||
                       test.test_code
                     );
            }).reduce((unique, record) => {
              // Remove duplicates based on course name
              const exists = unique.find(
                item => item.course_name?.toLowerCase() === record.course_name?.toLowerCase()
              );
              if (!exists) {
                unique.push(record);
              } else {
                // Merge tests from duplicate entries
                exists.tests = [...(exists.tests || []), ...(record.tests || [])];
              }
              return unique;
            }, []).map((record, index) => (
              <div key={index} className="bg-[#1A1F26] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-yellow-400">✦</span>
                  <h3 className="font-medium">{record.course_name}</h3>
                </div>
                {record.tests?.some(test => 
                  test.obtained_marks !== undefined || 
                  test.max_marks !== undefined ||
                  test.test_code
                ) ? (
                  <div className="space-y-4">
                    {record.tests
                      .filter(test => 
                        test.obtained_marks !== undefined || 
                        test.max_marks !== undefined ||
                        test.test_code
                      )
                      .map((test, testIndex) => (
                        <div key={testIndex} className="space-y-1">
                          <div className="text-sm text-gray-400 font-medium">
                            {test.test_code || test.name || 'Test'}
                          </div>
                          {test.obtained_marks !== undefined && test.max_marks !== undefined ? (
                            <div className={`
                              text-sm font-medium
                              ${test.obtained_marks >= (test.max_marks * 0.4) 
                                ? "text-green-400" 
                                : "text-red-400"}
                            `}>
                              {test.obtained_marks.toString().padStart(2, ' ')} / {test.max_marks}
                            </div>
                          ) : (
                            <div className="text-sm text-yellow-400 font-medium">
                              Pending
                            </div>
                          )}
                        </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">No tests conducted</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <AttendancePredictionModal
        isOpen={isPredictionModalOpen}
        onClose={() => setIsPredictionModalOpen(false)}
        attendanceData={attendanceData}
        timetableData={timetableData}
      />
    </div>
  );
};

export default Dashboard;

