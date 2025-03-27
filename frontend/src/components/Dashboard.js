"use client"
import React, { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import LoadingIndicator from "./LoadingIndicator"
import './Dashboard.css';
import AttendancePredictionModal from './AttendancePredictionModal';
import { CALENDAR_DATA } from '../data/calendar';
import { jsPDF } from 'jspdf';

const API_URL = process.env.NODE_ENV === 'development' 
  ? process.env.REACT_APP_LOCAL_API_URL 
  : process.env.REACT_APP_API_URL;

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
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [deadlines, setDeadlines] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [localEdits, setLocalEdits] = useState({});
  const navigate = useNavigate()
  const timetableRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshError, setRefreshError] = useState(null)
  const [refreshCooldown, setRefreshCooldown] = useState(false)
  const [cooldownTimer, setCooldownTimer] = useState(0)

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
    console.log("Today's day order:", todayDayOrder);
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
    console.log("Changing day to:", newDay);
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
      
      // Load saved edits from localStorage first
      const savedEdits = localStorage.getItem('timetableEdits');
      const localEdits = savedEdits ? JSON.parse(savedEdits) : {};
      setLocalEdits(localEdits);
      
      console.log("Fetching timetable data...")
      const response = await axios.get(`${API_URL}/api/timetable`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { password: password }
      })
      
      if (response.data.success) {
        // Merge local edits with timetable data
        const mergedTimetable = { ...response.data.timetable };
        
        // Apply local edits
        Object.entries(localEdits).forEach(([day, dayData]) => {
          if (!mergedTimetable[day]) {
            mergedTimetable[day] = {};
          }
          Object.entries(dayData).forEach(([timeSlot, slotData]) => {
            mergedTimetable[day][timeSlot] = slotData;
          });
        });
        
        console.log("Merged Timetable:", mergedTimetable);
        setTimetableData(mergedTimetable)
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

  const getSlotColor = (slot, timeSlot) => {
    if (!slot || !slot.courses || slot.courses.length === 0) return "bg-[#1E2A1E]"
    
    // Check if this is a manually edited cell
    if (slot.isManualEdit) return "bg-[#1e3a5a]" // Dark blue background for manual edits
    
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

  const getAttendanceInfo = (attended, total) => {
    const percentage = (attended / total) * 100;
    const classesNeeded = Math.ceil((0.75 * total - attended) / 0.25);
    const margin = Math.floor(attended - (0.75 * total));

    let status = {
      percentage: percentage.toFixed(2),
      colorClass: '',
      message: '',
      messageClass: ''
    };

    if (percentage >= 75) {
      status.colorClass = 'text-green-400';
      status.message = `Margin: ${margin}`;
      status.messageClass = 'text-blue-400';
    } else if (percentage >= 70) {
      status.colorClass = 'text-yellow-400';
      status.message = `Need ${classesNeeded} more`;
      status.messageClass = 'text-red-400';
    } else {
      status.colorClass = 'text-red-400';
      status.message = `Need ${classesNeeded} more`;
      status.messageClass = 'text-red-400';
    }

    return status;
  };

  const downloadTimetable = async () => {
    try {
      if (!timetableRef.current) return;

      // Create a PDF document
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Format time slots to match backend format (HH:mm)
      const timeSlots = [
        "08:00-08:50", "08:50-09:40", "09:45-10:35", "10:40-11:30",
        "11:35-12:25", "12:30-01:20", "01:25-02:15", "02:20-03:10",
        "03:10-04:00", "04:00-04:50"
      ];
      
      // Define table dimensions
      const margin = 10;
      const cellWidth = (pdf.internal.pageSize.width - margin * 2) / (timeSlots.length + 1);
      const cellHeight = 15;
      const startX = margin;
      const startY = margin;
      
      // Set title
      pdf.setFontSize(18);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Acadia Timetable', pdf.internal.pageSize.width / 2, startY - 5, { align: 'center' });
      
      // Draw header row
      pdf.setFillColor(45, 55, 72);
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      
      // Time header cell
      pdf.rect(startX, startY, cellWidth, cellHeight, 'F');
      pdf.text('Time', startX + cellWidth / 2, startY + cellHeight / 2, { align: 'center', baseline: 'middle' });
      
      // Time slot header cells
      timeSlots.forEach((slot, index) => {
        const x = startX + cellWidth * (index + 1);
        pdf.rect(x, startY, cellWidth, cellHeight, 'F');
        
        // Convert 24h format to 12h format for display
        const displayTime = slot.split('-').map(time => {
          const [hours, minutes] = time.split(':');
          const h = parseInt(hours);
          return `${h > 12 ? h - 12 : h}:${minutes}${h >= 12 ? 'PM' : 'AM'}`;
        }).join('-');
        
        pdf.text(displayTime, x + cellWidth / 2, startY + cellHeight / 2, { align: 'center', baseline: 'middle' });
      });
      
      // Draw day rows
      for (let day = 1; day <= 5; day++) {
        const rowY = startY + cellHeight * day;
        
        // Day label cell
        pdf.setFillColor(45, 55, 72);
        pdf.setTextColor(255, 255, 255);
        pdf.rect(startX, rowY, cellWidth, cellHeight, 'F');
        pdf.text(`Day ${day}`, startX + cellWidth / 2, rowY + cellHeight / 2, { align: 'center', baseline: 'middle' });
        
        // Subject cells
        timeSlots.forEach((timeSlot, index) => {
          const x = startX + cellWidth * (index + 1);
          
          // Get subject data
          const dayData = timetableData[`Day ${day}`] || {};
          const slotData = dayData[timeSlot];
          
          // Set appropriate fill color based on slot type
          if (slotData?.isManualEdit) {
            pdf.setFillColor(30, 64, 175, 0.3); // Dark blue for manual edits
          } else if (slotData?.courses?.[0]?.code?.startsWith('P')) {
            pdf.setFillColor(40, 167, 69, 0.15); // Green for practical
          } else if (slotData?.courses?.length > 0) {
            pdf.setFillColor(255, 193, 7, 0.15); // Yellow for theory
          } else {
            pdf.setFillColor(30, 42, 30); // Dark green for empty slots
          }
          
          // Draw cell background
          pdf.rect(x, rowY, cellWidth, cellHeight, 'F');
          
          // Draw cell content
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(8);
          
          if (slotData?.courses?.length > 0) {
            const course = slotData.courses[0];
            pdf.text(course.title || '', x + cellWidth / 2, rowY + cellHeight / 2 - 3, { align: 'center', baseline: 'middle' });
            pdf.text(course.code || '', x + cellWidth / 2, rowY + cellHeight / 2, { align: 'center', baseline: 'middle' });
            pdf.text(course.gcr_code || '', x + cellWidth / 2, rowY + cellHeight / 2 + 3, { align: 'center', baseline: 'middle' });
          } else {
            pdf.text('No class', x + cellWidth / 2, rowY + cellHeight / 2, { align: 'center', baseline: 'middle' });
          }
          
          // Draw cell border
          pdf.setDrawColor(0);
          pdf.rect(x, rowY, cellWidth, cellHeight);
        });
      }
      
      // Save the PDF
      pdf.save('timetable.pdf');
      
    } catch (error) {
      console.error('Error downloading timetable:', error);
      alert('Failed to download timetable. Please try again.');
    }
  };

  const handleEditCell = (timeSlot, course) => {
    setEditingCell({ timeSlot, day: currentDay });
    setEditValue(course ? course.title : "");
  };

  const handleSaveEdit = () => {
    try {
      const newEdits = { ...localEdits };
      
      if (editValue.trim() === "") {
        // Remove edit if empty
        if (newEdits[`Day ${editingCell.day}`]?.[editingCell.timeSlot]) {
          delete newEdits[`Day ${editingCell.day}`][editingCell.timeSlot];
          if (Object.keys(newEdits[`Day ${editingCell.day}`]).length === 0) {
            delete newEdits[`Day ${editingCell.day}`];
          }
        }
      } else {
        // Add/edit entry with full time slot
        newEdits[`Day ${editingCell.day}`] = {
          ...(newEdits[`Day ${editingCell.day}`] || {}),
          [editingCell.timeSlot]: {
            courses: [{
              title: editValue,
              code: "",
              faculty: "",
              gcr_code: ""
            }],
            isManualEdit: true
          }
        };
      }

      // Update state and storage
      localStorage.setItem('timetableEdits', JSON.stringify(newEdits));
      setLocalEdits(newEdits);
      
      // Force update timetable data
      const updatedTimetable = { ...timetableData };
      if (editValue.trim() === "") {
        delete updatedTimetable[`Day ${editingCell.day}`]?.[editingCell.timeSlot];
      } else {
        updatedTimetable[`Day ${editingCell.day}`] = {
          ...updatedTimetable[`Day ${editingCell.day}`],
          [editingCell.timeSlot]: {
            courses: [{
              title: editValue,
              code: "",
              faculty: "",
              gcr_code: ""
            }],
            isManualEdit: true
          }
        };
      }
      setTimetableData(updatedTimetable);
      
      alert("Timetable updated successfully!");
    } catch (error) {
      console.error("Failed to save edit:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setEditingCell(null);
      setEditValue("");
    }
  };

  const handleDeadlineAdd = (date, text) => {
    const newDeadlines = { ...deadlines };
    const dateStr = date.toISOString().split('T')[0];
    
    if (!text.trim()) {
      delete newDeadlines[dateStr];
    } else {
      newDeadlines[dateStr] = text;
    }
    
    setDeadlines(newDeadlines);
    localStorage.setItem('deadlines', JSON.stringify(newDeadlines));
  };

  // Load deadlines from localStorage on component mount
  useEffect(() => {
    const savedDeadlines = localStorage.getItem('deadlines');
    if (savedDeadlines) {
      setDeadlines(JSON.parse(savedDeadlines));
    }
  }, []);

  const renderCalendar = () => {
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' }).toUpperCase();
    const currentYear = currentDate.getFullYear().toString();
    
    const monthData = CALENDAR_DATA.find(
      m => m.month === currentMonth && m.year === currentYear
    );

    if (!monthData) return null;

    // Get month index (0-11) from month name
    const monthIndex = new Date(`${monthData.month} 1, ${currentYear}`).getMonth();

    return (
      <div className="mb-8 bg-gray-800/50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-medium">Academic Calendar</h2>
          <div className="flex items-center gap-4">
            <input 
              type="date" 
              value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="bg-gray-700 text-white px-3 py-2 rounded-lg"
            />
          </div>
        </div>

        {selectedDate && (
          <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
            <input
              type="text"
              placeholder="Enter deadline details"
              defaultValue={deadlines[selectedDate.toISOString().split('T')[0]] || ''}
              className="w-full bg-gray-600 text-white px-3 py-2 rounded-lg"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleDeadlineAdd(selectedDate, e.target.value);
                  setSelectedDate(null);
                }
              }}
              onBlur={(e) => {
                handleDeadlineAdd(selectedDate, e.target.value);
                setSelectedDate(null);
              }}
            />
          </div>
        )}

        <div className="grid grid-cols-7 gap-1 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-gray-400 text-sm py-2">{day}</div>
          ))}
          
          {monthData.days.map((day, index) => {
            // Create date object with the correct month index
            const date = new Date(currentYear, monthIndex, day.date);
            const dateStr = date.toISOString().split('T')[0];
            const hasDeadline = deadlines[dateStr];
            const isToday = date.toDateString() === new Date().toDateString();
            
            return (
              <div
                key={index}
                className={`
                  p-2 rounded-lg text-sm relative
                  ${isToday ? 'ring-2 ring-blue-500' : ''}
                  ${day.holiday ? 'bg-red-900/20' : day.dayOrder ? 'bg-green-900/20' : 'bg-gray-800/50'}
                  ${hasDeadline ? 'bg-yellow-900/20' : ''}
                  hover:bg-gray-700/50 cursor-pointer
                `}
                onClick={() => setSelectedDate(date)}
                title={[
                  day.holiday,
                  day.dayOrder ? `Day ${day.dayOrder}` : null,
                  hasDeadline ? deadlines[dateStr] : null
                ].filter(Boolean).join(' - ')}
              >
                <span className="block">{day.date}</span>
                {day.dayOrder && (
                  <span className="text-xs text-green-400">Day {day.dayOrder}</span>
                )}
                {hasDeadline && (
                  <span className="absolute top-0 right-0 w-2 h-2 bg-yellow-400 rounded-full"></span>
                )}
              </div>
            );
          })}
        </div>

        {/* Show all deadlines */}
        {Object.keys(deadlines).length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-2">Upcoming Deadlines</h3>
            <div className="space-y-2">
              {Object.entries(deadlines)
                .sort(([a], [b]) => new Date(a) - new Date(b))
                .map(([dateStr, text]) => (
                  <div key={dateStr} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-lg">
                    <div>
                      <span className="text-sm text-gray-400">
                        {new Date(dateStr).toLocaleDateString()}
                      </span>
                      <span className="ml-2">{text}</span>
                    </div>
                    <button
                      onClick={() => handleDeadlineAdd(new Date(dateStr), '')}
                      className="text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Add function to check refresh status
  const checkRefreshStatus = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await axios.get(`${API_URL}/api/refresh-status`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      if (response.data.success && response.data.status === "completed") {
        setRefreshing(false)
        // Update last updated timestamp
        if (response.data.updated_at) {
          setLastUpdated(response.data.updated_at)
          // Store the timestamp in localStorage
          localStorage.setItem("lastUpdated", response.data.updated_at)
        }
        
        // Refresh the data
        fetchTimetable()
        fetchAttendance()
        fetchMarks()
        
        return true
      }
      return false
    } catch (error) {
      console.error("Error checking refresh status:", error)
      setRefreshing(false)
      setRefreshError("Failed to check refresh status")
      return false
    }
  }

  // Function to format date to human-readable format
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Never"
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    })
  }
  
  // Load last updated timestamp on component mount
  useEffect(() => {
    const storedTimestamp = localStorage.getItem("lastUpdated")
    if (storedTimestamp) {
      setLastUpdated(storedTimestamp)
    }
  }, [])
  
  // Cooldown timer effect
  useEffect(() => {
    let interval
    if (refreshCooldown && cooldownTimer > 0) {
      interval = setInterval(() => {
        setCooldownTimer(prev => {
          if (prev <= 1) {
            setRefreshCooldown(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    
    return () => clearInterval(interval)
  }, [refreshCooldown, cooldownTimer])
  
  // Handle refresh button click
  const handleRefresh = async () => {
    // Don't proceed if already refreshing or in cooldown
    if (refreshing || refreshCooldown) return
    
    setRefreshing(true)
    setRefreshError(null)
    
    try {
      const token = localStorage.getItem("token")
      
      // Start the refresh process
      await axios.post(`${API_URL}/api/refresh-data`, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      // Poll for status every 5 seconds
      let completed = false
      let attempts = 0
      const maxAttempts = 30 // 2.5 minutes timeout (30 * 5 seconds)
      
      const statusInterval = setInterval(async () => {
        completed = await checkRefreshStatus()
        attempts++
        
        if (completed || attempts >= maxAttempts) {
          clearInterval(statusInterval)
          if (!completed && attempts >= maxAttempts) {
            setRefreshError("Refresh timed out. Please try again later.")
            setRefreshing(false)
          }
          
          // Set cooldown after refresh is completed
          setRefreshCooldown(true)
          setCooldownTimer(60) // 60 seconds cooldown
        }
      }, 5000)
      
    } catch (error) {
      console.error("Error refreshing data:", error)
      setRefreshing(false)
      setRefreshError(error.response?.data?.error || "Failed to refresh data")
      
      // Set cooldown even if refresh failed
      setRefreshCooldown(true)
      setCooldownTimer(60) // 60 seconds cooldown
    }
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
          <div>
            <p className="text-sm text-gray-400">{userEmail}</p>
            <p className="text-xs text-blue-400 mt-1">Academia Student Portal <span className="text-yellow-400">(Testing Version)</span></p>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-col items-end">
              <button 
                onClick={handleRefresh} 
                disabled={refreshing || refreshCooldown}
                className={`px-3 py-1 text-sm border border-gray-700 rounded flex items-center gap-2 ${
                  refreshing || refreshCooldown ? "bg-gray-700 cursor-not-allowed" : "hover:bg-gray-800"
                }`}
                title={refreshCooldown ? `Available in ${cooldownTimer} seconds` : "Refresh attendance & marks data"}
              >
                {refreshing ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Refreshing...
                  </>
                ) : refreshCooldown ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Wait {cooldownTimer}s
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Data
                  </>
                )}
              </button>
              {lastUpdated && (
                <p className="text-xs text-gray-500 mt-1">
                  Last updated: {formatTimestamp(lastUpdated)}
                </p>
              )}
              {refreshError && (
                <p className="text-xs text-red-500 mt-1">{refreshError}</p>
              )}
            </div>
            <button onClick={handleLogout} className="px-3 py-1 text-sm border border-gray-700 rounded">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Calendar Toggle Button */}
        <div className="mb-4 flex justify-end">
          <button 
            onClick={() => setShowCalendar(!showCalendar)}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
          </button>
        </div>

        {/* Calendar Section */}
        {showCalendar && renderCalendar()}

        {/* Timetable Section */}
        <div className="mb-8" ref={timetableRef}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium">Timetable</h2>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowDetails(!showDetails)} 
                className="text-gray-400 hover:text-white"
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
              <button 
                onClick={downloadTimetable} 
                className="text-gray-400 hover:text-white"
              >
                Download
              </button>
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
                const isEditing = editingCell?.timeSlot === timeSlot && editingCell?.day === currentDay;

                return (
                  <div
                    key={timeSlot}
                    className={`${getSlotColor(slotInfo, timeSlot)} p-4 rounded-lg ${
                      isCurrentClass ? 'ring-2 ring-blue-500 shadow-lg' : ''
                    }`}
                    onClick={() => !isEditing && handleEditCell(timeSlot, slotInfo?.courses?.[0])}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="bg-gray-800 text-white px-2 py-1 rounded w-full"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') {
                                  setEditingCell(null);
                                  setEditValue("");
                                }
                              }}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEdit();
                              }}
                              className="px-2 py-1 bg-green-600 text-white rounded"
                            >
                              Save
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCell(null);
                                setEditValue("");
                              }}
                              className="px-2 py-1 bg-red-600 text-white rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
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
                          </>
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
            {attendanceData.map((record, index) => {
              const attendanceInfo = getAttendanceInfo(
                record.hours_conducted - record.hours_absent,
                record.hours_conducted
              );

              return (
                <div key={index} className="attendance-card p-4 rounded-lg bg-gray-800/50 shadow-lg backdrop-blur-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium text-gray-100">{record.course_title}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        record.category === 'Theory' 
                          ? 'bg-amber-500/20 text-amber-300' 
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {record.category}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${
                        parseFloat(attendanceInfo.percentage) >= 75
                          ? "text-emerald-400"
                          : parseFloat(attendanceInfo.percentage) >= 70
                            ? "text-amber-400"
                            : "text-rose-400"
                      }`}>
                        {attendanceInfo.percentage}%
                      </div>
                      <div className={`text-sm ${
                        parseFloat(attendanceInfo.percentage) >= 75
                          ? "text-sky-400"
                          : "text-rose-400"
                      }`}>
                        {attendanceInfo.message}
                      </div>
                      <div className="text-sm text-gray-400">
                        {record.hours_conducted - record.hours_absent} / {record.hours_conducted}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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

