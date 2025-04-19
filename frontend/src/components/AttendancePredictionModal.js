import React, { useState, useEffect } from 'react';
import { CALENDAR_DATA } from '../data/calendar';

const AttendancePredictionModal = ({
  isOpen,
  onClose,
  attendanceData,
  timetableData
}) => {
  const [selectedDates, setSelectedDates] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [calendarData, setCalendarData] = useState([]);
  const [currentMonth, setCurrentMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);
  const [todayInfo, setTodayInfo] = useState(null);

  // Function to get today's day order
  const getTodayInfo = () => {
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

    if (!dayData) return null;

    return {
      date: today,
      dayOrder: dayData.dayOrder,
      holiday: dayData.holiday,
      note: dayData.note
    };
  };

  useEffect(() => {
    if (isOpen) {
      // Initialize calendar data
      setCalendarData(CALENDAR_DATA);

      // Get unique months from the calendar data
      const months = CALENDAR_DATA.map(month => `${month.month} ${month.year}`);
      setAvailableMonths(months);

      // Set current month to today's month if available, otherwise first month
      const today = new Date();
      const currentMonthStr = `${today.toLocaleString('default', { month: 'long' }).toUpperCase()} ${today.getFullYear()}`;
      if (months.includes(currentMonthStr)) {
        setCurrentMonth(currentMonthStr);
      } else if (months.length > 0) {
        setCurrentMonth(months[0]);
      }

      // Set today's info
      setTodayInfo(getTodayInfo());
    }
  }, [isOpen]);

  const getMonthData = (monthYear) => {
    if (!monthYear) return [];
    const [targetMonth, targetYear] = monthYear.split(' ');

    // Find the month data
    const monthData = CALENDAR_DATA.find(
      m => m.month === targetMonth && m.year === targetYear
    );

    if (!monthData) return [];

    // Convert the days data to the format we need
    return monthData.days.map(day => ({
      date: new Date(`${monthData.month} ${day.date}, ${monthData.year}`),
      dayName: day.day,
      dayOrder: day.dayOrder,
      holiday: day.holiday,
      note: day.note
    }));
  };

  const getEmptyCellsCount = (monthYear) => {
    if (!monthYear) return 0;
    const [month, year] = monthYear.split(' ');
    const firstDay = new Date(`${month} 1, ${year}`);
    return firstDay.getDay();
  };

  // Removed unused function getDaysInMonth

  useEffect(() => {
    if (selectedDates.length > 0 && attendanceData) {
      console.log('Attendance Data:', attendanceData);
      console.log('Timetable Data:', timetableData);

      // Calculate predictions for each subject
      const newPredictions = attendanceData
        .filter(subject => subject.course_title.toLowerCase() !== 'course title')
        .map(subject => {
          const totalClasses = subject.hours_conducted;
          const presentClasses = totalClasses - subject.hours_absent;
          const currentPercentage = (presentClasses / totalClasses) * 100;

          console.log(`Processing subject: ${subject.course_title} (${subject.is_lab ? 'Lab' : 'Theory'})`, subject);

          // Count affected classes for this subject on selected dates
          const affectedClasses = selectedDates.reduce((count, selectedDate) => {
            // Find the month data for this date
            const monthData = CALENDAR_DATA.find(month => {
              const selectedMonth = selectedDate.toLocaleString('default', { month: 'long' }).toUpperCase();
              const selectedYear = selectedDate.getFullYear().toString();
              return month.month === selectedMonth && month.year === selectedYear;
            });

            if (!monthData) return count;

            // Find the day data
            const dayData = monthData.days.find(day =>
              day.date === selectedDate.getDate()
            );

            if (dayData && dayData.dayOrder !== null) {
              // Get all slots for this day order
              const daySlots = timetableData[`Day ${dayData.dayOrder}`] || {};

              // Debug the timetable structure for this day
              if (dayData.dayOrder === 2 || dayData.dayOrder === 3) {
                console.log(`Detailed timetable for Day ${dayData.dayOrder}:`, JSON.stringify(daySlots, null, 2));

                // Check if there's a color property in the timetable data
                Object.entries(daySlots).forEach(([slotKey, slot]) => {
                  if (slot.courses) {
                    slot.courses.forEach(course => {
                      console.log(`Course in Day ${dayData.dayOrder}, Slot ${slotKey}:`, {
                        title: course.title,
                        type: course.type,
                        color: course.color,
                        bgColor: course.bgColor,
                        allProperties: Object.keys(course)
                      });
                    });
                  }
                });
              }

              // Count how many times this subject appears in this day's slots
              const classesOnThisDay = Object.entries(daySlots).reduce((slotCount, [slotKey, slot]) => {
                if (!slot.courses) return slotCount;

                // Count matching courses in this slot
                const matchingCourses = slot.courses.filter(course => {
                  const courseTitle = course.title.toLowerCase();
                  const subjectTitle = subject.course_title.toLowerCase();

                  // Check if the course titles match
                  if (courseTitle !== subjectTitle) {
                    return false;
                  }

                  // Get course type and attendance category
                  const courseType = course.type?.toLowerCase() || '';
                  const isPractical = subject.category?.toLowerCase() === 'practical';

                  // Check if this course is a practical/lab course
                  const isCoursePractical = courseType.includes('practical') ||
                                           courseType.includes('lab');

                  // For lab-based theory courses, we need special handling
                  const isLabBasedTheory = courseType.includes('lab based theory');

                  // Matching logic
                  let isMatch = false;

                  // Get the original slot code from the slot data
                  const originalSlot = slot.original_slot || '';

                  // Check if this is a lab/practical slot based on the original_slot value
                  // In the timetable, slots starting with 'P' are practical/lab slots
                  const isLabSlot = originalSlot.startsWith('P');

                  // Simple matching logic
                  if (isPractical && isLabSlot) {
                    // Match practical attendance with lab slots (starting with 'P')
                    isMatch = true;
                  } else if (!isPractical && !isLabSlot) {
                    // Match theory attendance with theory slots (not starting with 'P')
                    isMatch = true;
                  }

                  // Debug information
                  console.log(`Course match for ${courseTitle}:`, {
                    courseType,
                    originalSlot,
                    isLabSlot,
                    isPractical,
                    isCoursePractical,
                    isLabBasedTheory,
                    isMatch
                  });

                  return isMatch;
                });

                return slotCount + matchingCourses.length;
              }, 0);

              console.log(`Day ${dayData.dayOrder} - Found ${classesOnThisDay} classes for ${subject.course_title}`);
              return count + classesOnThisDay;
            }
            return count;
          }, 0);

          // Calculate predicted attendance
          const newTotal = totalClasses + affectedClasses;
          const predictedPercentage = ((presentClasses) / newTotal) * 100;

          // Calculate required classes if below 75%
          let requiredClasses = 0;
          if (predictedPercentage < 75) {
            let tempTotal = newTotal;
            let tempPresent = presentClasses;
            while ((tempPresent / tempTotal) * 100 < 75) {
              tempPresent++;
              tempTotal++;
              requiredClasses++;
            }
          }

          return {
            subject: subject.course_title,
            currentPercentage,
            predictedPercentage,
            affectedClasses,
            requiredClasses,
            risk: predictedPercentage < 65 ? 'high' : predictedPercentage < 75 ? 'medium' : 'low'
          };
        });

      setPredictions(newPredictions);
    }
  }, [selectedDates, attendanceData, timetableData]);

  if (!isOpen) return null;

  const currentMonthData = getMonthData(currentMonth);
  const emptyCells = getEmptyCellsCount(currentMonth);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1A1F26] rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-medium text-white">Attendance Prediction</h2>
            {todayInfo && (
              <div className="mt-2 text-sm">
                <span className="text-gray-400">Today: </span>
                {todayInfo.holiday ? (
                  <span className="text-yellow-400">{todayInfo.holiday}</span>
                ) : todayInfo.dayOrder ? (
                  <span className="text-green-400">Day {todayInfo.dayOrder}</span>
                ) : (
                  <span className="text-gray-400">No Classes</span>
                )}
                {todayInfo.note && (
                  <span className="text-blue-400 ml-2">({todayInfo.note})</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Date Selection */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-200">Select Dates</h3>
            <div className="flex gap-2">
              {availableMonths.map(month => (
                <button
                  key={month}
                  onClick={() => setCurrentMonth(month)}
                  className={`px-3 py-1 rounded text-sm ${
                    currentMonth === month
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  }`}
                >
                  {month.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs text-gray-400 py-1 font-medium">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array(emptyCells).fill(null).map((_, index) => (
              <div key={`empty-${index}`} className="p-2 invisible">
                <div className="text-base font-medium">&nbsp;</div>
              </div>
            ))}

            {currentMonthData.map((day, index) => {
              const isNonClassDay = day.dayOrder === null;
              const isSelected = selectedDates.some(d => d.toDateString() === day.date.toDateString());

              return (
                <button
                  key={`day-${index}`}
                  onClick={() => {
                    if (isNonClassDay) {
                      // If it's a holiday, show an alert with the holiday name
                      if (day.holiday) {
                        alert(`Holiday: ${day.holiday}`);
                      }
                      return;
                    }
                    setSelectedDates(prev =>
                      isSelected
                        ? prev.filter(d => d.toDateString() !== day.date.toDateString())
                        : [...prev, day.date]
                    );
                  }}
                  disabled={day.dayOrder === null && !day.holiday}
                  className={`
                    relative p-2 rounded text-center flex flex-col items-center justify-center min-h-[3rem]
                    ${day.holiday
                      ? 'bg-yellow-800/30 text-yellow-200/70 cursor-pointer'
                      : isNonClassDay
                        ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                        : isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-700/50 text-gray-200 hover:bg-gray-600'}
                  `}
                  title={day.holiday || day.note || ''}
                >
                  <div className="text-base font-medium">{day.date.getDate()}</div>
                  {!isNonClassDay && (
                    <div className="text-[10px] mt-0.5 opacity-60">Day {day.dayOrder}</div>
                  )}
                  {(day.holiday || day.note) && (
                    <div className="absolute top-0 right-0 w-2 h-2 bg-yellow-400 rounded-full mr-1 mt-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Dates Summary */}
        {selectedDates.length > 0 && (
          <div className="mb-4 p-3 bg-gray-800 rounded-lg">
            <h4 className="text-sm font-medium text-gray-200 mb-2">Selected Dates:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedDates.sort((a, b) => a - b).map(date => (
                <span key={date.toISOString()} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Predictions */}
        {selectedDates.length > 0 && predictions.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-200 mb-2">Predictions:</h3>
            {predictions.map((prediction, index) => (
              <div
                key={index}
                className="bg-[#2A2F36] rounded-lg p-4"
              >
                <h3 className="font-medium text-white mb-4">{prediction.subject}</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-gray-400">Current</div>
                      <div className={`text-lg font-medium ${
                        prediction.currentPercentage >= 75 ? 'text-green-400' :
                        prediction.currentPercentage >= 60 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {prediction.currentPercentage.toFixed(1)}%
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-gray-400">Predicted</div>
                      <div className={`text-lg font-medium ${
                        prediction.predictedPercentage >= 75 ? 'text-green-400' :
                        prediction.predictedPercentage >= 60 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {prediction.predictedPercentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-700/50">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Classes Affected</span>
                        <span className="text-white font-medium ml-2">{prediction.affectedClasses}</span>
                      </div>
                      {prediction.predictedPercentage < 75 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Required for 75%</span>
                          <span className="text-yellow-400 font-medium ml-2">{prediction.requiredClasses}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendancePredictionModal;