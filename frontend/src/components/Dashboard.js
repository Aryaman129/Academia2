"use client"
import React, { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import LoadingIndicator from "./LoadingIndicator"
import './Dashboard.css';

const API_URL = "http://localhost:5050"

const Dashboard = () => {
  // Attendance state
  const [attendanceData, setAttendanceData] = useState([])
  // Timetable state
  const [timetableData, setTimetableData] = useState({})
  // const [batch, setBatch] = useState("")
  // const [personalDetails, setPersonalDetails] = useState({})
  // Marks state (new)
  const [marksData, setMarksData] = useState({})
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userEmail, setUserEmail] = useState("")
  const navigate = useNavigate()

  const parseTimeSlot = (timeSlot) => {
    let [start] = timeSlot.split("-");
    let [hour, minute] = start.trim().split(":").map(Number);
    if (hour < 8) { hour += 12; }
    return hour * 60 + minute;
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

  // Fetch marks data (new)
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

  if (loading) return <LoadingIndicator message="Fetching your data..." />

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
          <h1 className="text-2xl font-bold">Dashboard</h1>
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

      {/* Timetable Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Timetable</h2>
        {Object.keys(timetableData).length > 0 ? (
          Object.entries(timetableData).map(([day, slots]) => (
            <div key={day} className="bg-white shadow-md rounded-lg p-4 mb-4">
              <h3 className="text-xl font-semibold mb-2">{day}</h3>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Time Slot</th>
                    <th className="px-4 py-2 text-left">Course(s)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(slots)
                    .sort((a, b) => parseTimeSlot(a[0]) - parseTimeSlot(b[0]))
                    .map(([timeSlot, slotInfo]) => (
                      <tr key={timeSlot}>
                        <td className="px-4 py-2">{timeSlot}</td>
                        <td className="px-4 py-2">
                          {slotInfo.courses && slotInfo.courses.length > 0
                            ? slotInfo.courses.map((course, idx) => (
                                <span key={idx}>
                                  {course.title}
                                  {idx < slotInfo.courses.length - 1 && ", "}
                                </span>
                              ))
                            : slotInfo.original_slot || "Empty"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))
        ) : (
          <p>No timetable data found.</p>
        )}
      </div>

      {/* Attendance Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Attendance</h2>
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
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${record.attendance_percentage < 75 ? "text-red-600" : "text-green-600"}`}>
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

      {/* Marks Section */}
           {/* Marks Section */}
     <div className="mb-6">
       <h2 className="text-2xl font-bold mb-2">Marks</h2>
       {marksData && marksData.records && marksData.records.length > 0 ? (
         (() => {
           // Filter out header rows and rows without test details
           const validMarksRecords = marksData.records.filter(record => {
             const name = record.course_name.trim().toLowerCase();
             if (name === "" || name === "semester:" || name === "course title") {
               return false;
             }
             if (!record.tests || record.tests.length === 0) {
               return false;
             }
             return true;
           });
     
           return validMarksRecords.length > 0 ? (
             <div className="bg-white shadow-md rounded-lg overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-gray-50">
                     <tr>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Course Name
                       </th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Test Details
                       </th>
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                     {validMarksRecords.map((record, idx) => (
                       <tr key={idx}>
                         <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                           {record.course_name}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm">
                           {record.tests.map((test, tIdx) => (
                             <div key={tIdx}>
                               {test.test_code}: {test.obtained_marks} / {test.max_marks}
                             </div>
                           ))}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
           ) : (
             <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
               <p className="font-medium">No valid marks records found.</p>
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
           );
         })()
       ) : (
         <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
           <p className="font-medium">No marks records found.</p>
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

    </div>
  );
};

export default Dashboard;

