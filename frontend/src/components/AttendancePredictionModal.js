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

  useEffect(() => {
    if (isOpen) {
      const parsedData = parseCalendarData(CALENDAR_DATA);
      setCalendarData(parsedData);
      
      // Get unique months from the calendar data
      const months = [...new Set(parsedData.map(day => 
        day.date.toLocaleString('default', { month: 'long', year: 'numeric' })
      ))];
      setAvailableMonths(months);
      
      // Set current month to the first available month
      if (months.length > 0 && !currentMonth) {
        setCurrentMonth(months[0]);
      }
    }
  }, [isOpen]);

  const parseCalendarData = (text) => {
    const lines = text.split('\n');
    const data = [];
    let currentMonth = '';
    let currentYear = '';

    lines.forEach(line => {
      if (!line.trim()) return;
      
      if (line.match(/^[A-Z]+ \d{4}$/)) {
        const [month, year] = line.split(' ');
        currentMonth = month;
        currentYear = year;
        return;
      }

      if (line.includes('Date') || line.includes('Day Order')) return;

      const match = line.match(/(\d{1,2})\s*\|\s*([A-Za-z]+)\s*\|\s*(-|\d+)/);
      if (match) {
        const [, day, dayName, dayOrder] = match;
        const date = new Date(`${currentMonth} ${day}, ${currentYear}`);
        if (!isNaN(date.getTime())) {
          data.push({
            date,
            dayName,
            dayOrder: dayOrder === '-' ? null : parseInt(dayOrder)
          });
        }
      }
    });

    return data;
  };

  const getMonthData = (monthYear) => {
    const [targetMonth, targetYear] = monthYear.split(' ');
    return calendarData.filter(day => {
      const dayMonth = day.date.toLocaleString('default', { month: 'long' });
      const dayYear = day.date.getFullYear().toString();
      return dayMonth === targetMonth && dayYear === targetYear;
    });
  };

  const getEmptyCellsCount = (monthYear) => {
    if (!monthYear) return 0;
    const [month, year] = monthYear.split(' ');
    const firstDay = new Date(`${month} 1, ${year}`).getDay();
    return firstDay;
  };

  useEffect(() => {
    if (selectedDates.length > 0 && attendanceData) {
      // Calculate predictions for each subject
      const newPredictions = attendanceData
        .filter(subject => subject.course_title.toLowerCase() !== 'course title')
        .map(subject => {
        const totalClasses = subject.hours_conducted;
        const presentClasses = totalClasses - subject.hours_absent;
        const currentPercentage = (presentClasses / totalClasses) * 100;

        // Count affected classes for this subject on selected dates
        const affectedClasses = selectedDates.reduce((count, date) => {
          const dayData = calendarData.find(d => 
            d.date.toDateString() === date.toDateString()
          );
          
          if (dayData?.dayOrder) {
            // Get all slots for this day order
            const daySlots = timetableData[`Day ${dayData.dayOrder}`] || {};
            
            // Count how many times this subject appears in this day's slots
            const classesOnThisDay = Object.values(daySlots).reduce((slotCount, slot) => {
              if (!slot.courses) return slotCount;
              
              // Count matching courses in this slot
              const matchingCourses = slot.courses.filter(course => {
                const courseTitle = course.title.toLowerCase();
                const subjectTitle = subject.course_title.toLowerCase();
                
                // Check if this is a lab class
                const isLabClass = 
                  courseTitle.includes('lab') || 
                  subjectTitle.includes('lab') ||
                  courseTitle.includes('laboratory') || 
                  subjectTitle.includes('laboratory');
                
                // Match only if both are lab classes or both are theory classes
                return courseTitle === subjectTitle && 
                       (courseTitle.includes('lab') === subjectTitle.includes('lab'));
              });
              
              return slotCount + matchingCourses.length;
            }, 0);
            
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
  }, [selectedDates, attendanceData, timetableData, calendarData]);

  if (!isOpen) return null;

  const currentMonthData = getMonthData(currentMonth);
  const emptyCells = getEmptyCellsCount(currentMonth);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1A1F26] rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-medium text-white">Attendance Prediction</h2>
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
            {/* Add empty cells for days before the first day of the month */}
            {Array(emptyCells).fill(null).map((_, index) => (
              <button key={`empty-${index}`} className="p-2 invisible">
                {/* Empty cell */}
              </button>
            ))}
            
            {currentMonthData.map((day, index) => (
              <button
                key={index}
                onClick={() => {
                  if (!day || !day.dayOrder) return;
                  setSelectedDates(prev => 
                    prev.some(d => d.toDateString() === day.date.toDateString())
                      ? prev.filter(d => d.toDateString() !== day.date.toDateString())
                      : [...prev, day.date]
                  );
                }}
                disabled={!day || !day.dayOrder}
                className={`
                  p-2 rounded text-sm font-medium
                  ${!day ? 'invisible' :
                    !day.dayOrder ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 
                    selectedDates.some(d => d.toDateString() === day.date.toDateString())
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}
                `}
              >
                {day.date.getDate()}
                {day.dayOrder && (
                  <div className="text-[10px] opacity-50">Day {day.dayOrder}</div>
                )}
              </button>
            ))}
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