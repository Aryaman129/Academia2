"use client"
import React, { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import LoadingIndicator from "./LoadingIndicator"
import './Dashboard.css';
import AttendancePredictionModal from './AttendancePredictionModal';
import { CALENDAR_DATA } from '../data/calendar';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5050"

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
  const [currentDay, setCurrentDay] = useState(null)
  const [isPredictionModalOpen, setIsPredictionModalOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate()

  // Function to get today's day order from calendar
  const getTodayDayOrder = () => {
    const today = new Date();
    const monthName = today.toLocaleString('default', { month: 'long' }).toUpperCase();
    const year = today.getFullYear().toString();
    
    // Find current month in calendar data
    const monthData = CALENDAR_DATA.find(
      m => m.month === monthName && m.year === year
    );

    if (!monthData) return null;

    // Find today's data
    const dayData = monthData.days.find(day => 
      day.date === today.getDate()
    );

    return dayData?.dayOrder || null;
  };

  // Initialize current day on mount
  useEffect(() => {
    const todayDayOrder = getTodayDayOrder();
    if (todayDayOrder) {
      setCurrentDay(todayDayOrder);
    } else {
      setCurrentDay(1); // Default to Day 1 if today's day order is not found
    }
  }, []);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second for more accurate time display
    
    return () => clearInterval(timer);
  }, []);

  const handleDayChange = (newDay) => {
    if (newDay < 1) {
      setCurrentDay(5)  // Loop to day 5 when going below day 1
    } else if (newDay > 5) {
      setCurrentDay(1)  // Loop to day 1 when going above day 5
    } else {
      setCurrentDay(newDay)
    }
  }

  // Add function to check if a time slot is current
  const isCurrentTimeSlot = (timeSlot) => {
    const [startTime, endTime] = timeSlot.split("-").map(t => t.trim());
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    
    const now = currentTime;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Only show ongoing classes between 8am and 5pm
    if (currentHour < 8 || currentHour >= 17) {
      return false;
    }
    
    // Convert all times to minutes for easier comparison
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = endHour * 60 + endMinute;
    
    return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
  };

  // Format time to 12-hour format
  const formatTimeTo12Hour = (timeStr) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Format time slot to 12-hour format
  const formatTimeSlot = (timeSlot) => {
    const [startTime, endTime] = timeSlot.split("-").map(t => t.trim());
    return `${formatTimeTo12Hour(startTime)} - ${formatTimeTo12Hour(endTime)}`;
  };

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
        // Extract records from response
        const records = response.data.attendance.records || [];
        
        // Filter out header rows and empty records
        // Use set to ensure uniqueness based on course title AND category
        const seen = new Set();
        const uniqueRecords = [];
        
        for (const record of records) {
          // Skip invalid records and headers
          if (!record.course_title || 
              record.course_title.trim() === "Course Title" || 
              !record.attendance_percentage ||
              !record.category) {
            continue;
          }
          
          // Create unique key combining course title and category
          const uniqueKey = `${record.course_title}-${record.category}`;
          
          // Only add if this combination hasn't been seen before
          if (!seen.has(uniqueKey)) {
            seen.add(uniqueKey);
            uniqueRecords.push(record);
          }
        }
        
        setAttendanceData(uniqueRecords);
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
    
    // Simple fetch logic without extra flags
    const fetchDataOnce = async () => {
      try {
        await fetchTimetable()
        await fetchAttendance()
        await fetchMarks()
        setLoading(false)
      } catch (error) {
        console.error("Error fetching data:", error)
        setLoading(false)
      }
    }
    
    fetchDataOnce()
    
    return () => {
      // Clean-up logic if needed
    }
  }, [fetchAttendance, fetchTimetable, fetchMarks, navigate])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("userEmail")
    localStorage.removeItem("userId")
    navigate("/")
  }

  const handleRefresh = () => {
    setLoading(true)
    
    // Simple sequential fetching to avoid race conditions
    const refreshData = async () => {
      try {
        await fetchTimetable()
        await fetchAttendance()
        await fetchMarks()
      } catch (error) {
        console.error("Error refreshing data:", error)
      } finally {
        setLoading(false)
      }
    }
    
    refreshData()
  }

  const getSlotColor = (slot, timeSlot) => {
    if (!slot || !slot.courses || slot.courses.length === 0) return "bg-[#1E2A1E]"
    
    // Parse the time to determine if it's before or after 12:30
    const time = timeSlot.split("-")[0].trim()
    const [hours, minutes] = time.split(":").map(Number)
    const isAfternoonSlot = hours >= 12 || (hours === 12 && minutes >= 30)
    
    // Check if it's batch 1 or 2
    const isBatch2 = batch.includes("2")
    
    // Get the slot code from the course info
    let slotCode = "";
    if (slot.original_slot) {
      slotCode = slot.original_slot;
    } else if (slot.courses && slot.courses[0] && slot.courses[0].slot) {
      slotCode = slot.courses[0].slot;
    }
    
    // For Batch 2:
    if (isBatch2) {
      // Check if the slot code starts with 'P' (lab slot)
      if (slotCode.startsWith('P')) {
        return "bg-[#1A3D19]" // More dim green for lab
      } else {
        return "bg-[#FFD700]/20" // Yellow for theory
      }
    } 
    // For Batch 1:
    else {
      // Check if the slot code starts with 'P' (lab slot)
      if (slotCode.startsWith('P')) {
        return "bg-[#1A3D19]" // More dim green for lab
      } else {
        return "bg-[#FFD700]/20" // Yellow for theory
      }
    }
  }

  const getAttendanceStatus = (attended, total) => {
    const percentage = (attended / total) * 100;
    const classesNeeded = Math.ceil((0.75 * total - attended) / 0.25);
    const margin = Math.floor(attended - (0.75 * total));

    if (percentage < 75) {
      return {
        type: 'required',
        message: `Need ${classesNeeded} more`,
        color: 'low'
      };
    } else if (percentage === 75) {
      return {
        type: 'warning',
        message: 'At threshold',
        color: 'medium'
      };
    } else {
      return {
        type: 'margin',
        message: `Margin: ${margin}`,
        color: 'high'
      };
    }
  };

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
          <div>
            <p className="text-sm text-gray-400">{userEmail}</p>
            <p className="text-xs text-blue-400 mt-1">Academia Student Portal <span className="text-yellow-400">(Testing Version)</span></p>
          </div>
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
              <button 
                onClick={() => setShowDetails(!showDetails)} 
                className="text-gray-400 hover:text-white"
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
              <button className="text-gray-400 hover:text-white">Download</button>
              <button className="text-gray-400 hover:text-white">ⓘ</button>
            </div>
          </div>
          <div className="space-y-1">
            {Object.entries(timetableData[`Day ${currentDay}`] || {})
              .sort(([a], [b]) => {
                const parseTime = (time) => {
                  const [hours, minutes] = time.split(":").map(Number);
                  let totalMinutes = hours * 60 + minutes;
                  if (hours < 8) totalMinutes += 12 * 60;
                  return totalMinutes;
                };
                
                const timeA = parseTime(a.split("-")[0].trim());
                const timeB = parseTime(b.split("-")[0].trim());
                return timeA - timeB;
              })
              .map(([timeSlot, slotInfo]) => {
                const isCurrentClass = isCurrentTimeSlot(timeSlot);
                return (
                  <div
                    key={timeSlot}
                    className={`${getSlotColor(slotInfo, timeSlot)} p-4 rounded-lg ${
                      isCurrentClass ? 'ring-2 ring-blue-500 shadow-lg' : ''
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        {slotInfo.courses && slotInfo.courses.length > 0 ? (
                          slotInfo.courses.map((course, idx) => (
                            <div key={idx}>
                              <div className={`text-sm ${isCurrentClass ? 'font-bold text-white' : 'font-medium'}`}>
                                {course.title}
                                {isCurrentClass && <span className="ml-2 text-blue-400 text-xs">• ONGOING</span>}
                              </div>
                              {showDetails && (
                                <div className={`mt-2 space-y-1 text-xs ${isCurrentClass ? 'text-gray-300' : 'text-gray-400'}`}>
                                  <div>Code: {course.code}</div>
                                  <div>Faculty: {course.faculty.split('(')[0].trim()}</div>
                                  <div>Classroom: {course.gcr_code}</div>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm opacity-60">No class scheduled</div>
                        )}
                      </div>
                      <div className={`text-xs ml-4 font-medium ${
                        isCurrentClass ? 'text-blue-400' : 'text-gray-400'
                      }`}>
                        {formatTimeSlot(timeSlot)}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="flex justify-between items-center mt-4">
            <button 
              onClick={() => handleDayChange(currentDay - 1)}
              className="text-gray-400 hover:text-white"
            >
              ← Day {currentDay === 1 ? 5 : currentDay - 1}
            </button>
            <button 
              onClick={() => {
                const todayDayOrder = getTodayDayOrder();
                if (todayDayOrder) {
                  setCurrentDay(todayDayOrder);
                }
              }} 
              className={`px-4 py-2 rounded-lg text-sm ${
                getTodayDayOrder() === null 
                  ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed' 
                  : 'bg-gray-800 text-white hover:bg-gray-700'
              }`}
              disabled={getTodayDayOrder() === null}
              title={getTodayDayOrder() === null ? "No classes today" : ""}
            >
              Today {getTodayDayOrder() ? `(Day ${getTodayDayOrder()})` : ''}
            </button>
            <button 
              onClick={() => handleDayChange(currentDay + 1)}
              className="text-gray-400 hover:text-white"
            >
              Day {currentDay === 5 ? 1 : currentDay + 1} →
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
                  <div>
                    <h3 className="text-lg font-medium">{record.course_title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{record.course_code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        record.category === 'Theory' 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {record.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 text-sm" title="Classes Attended">
                        {record.hours_conducted - record.hours_absent}
                      </span>
                      <span className="text-gray-400">/</span>
                      <span className="text-sm" title="Total Classes">
                        {record.hours_conducted}
                      </span>
                      <span className="text-red-400 text-xs ml-2" title="Classes Missed">
                        ({record.hours_absent} missed)
                      </span>
                    </div>
                    <div className={`text-sm font-medium w-20 text-right ${
                      parseFloat(record.attendance_percentage) >= 75 
                        ? "text-green-400" 
                        : parseFloat(record.attendance_percentage) >= 70
                          ? "text-yellow-400"
                          : "text-red-400"
                    }`}>
                      {record.attendance_percentage}%
                      {parseFloat(record.attendance_percentage) < 75 && (
                        <div className="text-xs text-red-400 font-normal">
                          {getAttendanceStatus(record.hours_conducted - record.hours_absent, record.hours_conducted).message}
                        </div>
                      )}
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
                            <div className="text-sm font-medium">
                              <span className={`
                                ${test.obtained_marks === test.max_marks 
                                  ? "text-green-400"  // Full marks - bright green
                                  : test.obtained_marks >= (test.max_marks * 0.4)
                                    ? "text-green-500/80"  // Passing marks - slightly dimmer green
                                    : "text-red-400"}  // Failed - red
                              `}>
                                {test.obtained_marks.toString().padStart(2, ' ')}
                              </span>
                              <span className="text-gray-400"> / </span>
                              <span className="text-green-400">{test.max_marks}</span>
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

