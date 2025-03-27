import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TimetableDownload from './TimetableDownload';
import { CALENDAR_DATA } from '../data/calendar';
import './Timetable.css';

const Timetable = () => {
  const [timetableData, setTimetableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDownload, setShowDownload] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [customEntries, setCustomEntries] = useState({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [events, setEvents] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(null);

  useEffect(() => {
    fetchTimetable();
    // Load custom entries from localStorage
    const savedEntries = localStorage.getItem('timetableCustomEntries');
    if (savedEntries) {
      setCustomEntries(JSON.parse(savedEntries));
    }
    // Load events from localStorage
    const savedEvents = localStorage.getItem('timetableEvents');
    if (savedEvents) {
      setEvents(JSON.parse(savedEvents));
    }
    // Set current week
    updateCurrentWeek();
  }, []);

  const updateCurrentWeek = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4); // Friday
    setCurrentWeek({ start: startOfWeek, end: endOfWeek });
  };

  const getDayOrderForDate = (date) => {
    const month = date.toLocaleString('en-US', { month: 'UPPERCASE' });
    const year = date.getFullYear().toString();
    const dayOfMonth = date.getDate();

    const monthData = CALENDAR_DATA.find(m => m.month === month && m.year === year);
    if (!monthData) return null;

    const dayData = monthData.days.find(d => d.date === dayOfMonth);
    if (!dayData || dayData.holiday) return null;

    return dayData.dayOrder;
  };

  const getDayFromDayOrder = (dayOrder) => {
    if (!dayOrder) return '';
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][dayOrder - 1] || '';
  };

  const fetchTimetable = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/timetable`);
      const formattedData = response.data.map(item => ({
        name: item.course_title,
        code: item.course_code,
        category: item.category,
        dayOrder: getDayFromDayOrder(item.day_order),
        startTime: formatTime(item.start_time),
        isOnline: item.mode === 'online'
      }));
      setTimetableData(formattedData);
      setLoading(false);
    } catch (err) {
      setError('Failed to load timetable');
      setLoading(false);
    }
  };

  const handleCellClick = (day, timeSlot) => {
    if (!isEditing) return;
    setEditingCell({ day, timeSlot });
  };

  const handleCellEdit = (day, timeSlot, value) => {
    const newCustomEntries = { ...customEntries };
    
    if (!value.trim()) {
      delete newCustomEntries[`${day}-${timeSlot}`];
    } else {
      newCustomEntries[`${day}-${timeSlot}`] = {
        name: value,
        code: 'Custom',
        category: 'Theory'
      };
    }

    setCustomEntries(newCustomEntries);
    localStorage.setItem('timetableCustomEntries', JSON.stringify(newCustomEntries));
    setEditingCell(null);
  };

  const handleEventAdd = (date, event) => {
    const newEvents = { ...events };
    const dateStr = date.toISOString().split('T')[0];
    const dayOrder = getDayOrderForDate(date);
    
    if (!event.trim()) {
      delete newEvents[dateStr];
    } else {
      if (!dayOrder) {
        alert('Selected date is either a holiday or not in the academic calendar');
        return;
      }
      
      newEvents[dateStr] = {
        text: event,
        dayOrder: getDayFromDayOrder(dayOrder)
      };
    }

    setEvents(newEvents);
    localStorage.setItem('timetableEvents', JSON.stringify(newEvents));
    setSelectedDate(null);
  };

  const formatTime = (time) => {
    return time;
  };

  const getSubjectForCell = (day, timeSlot) => {
    // Check for events first
    const eventForDay = Object.entries(events).find(([dateStr, event]) => {
      return isDateInCurrentWeek(dateStr) && event.dayOrder === day;
    });

    if (eventForDay) {
      const [dateStr, event] = eventForDay;
      const date = new Date(dateStr);
      const formattedDate = `${date.getDate()}/${date.getMonth() + 1}`;
      return {
        name: `${event.text} (${formattedDate})`,
        code: 'Event',
        category: 'event'
      };
    }

    // Check for custom entry
    const customEntry = customEntries[`${day}-${timeSlot}`];
    if (customEntry) return customEntry;

    // Then check regular timetable
    return timetableData.find(
      subject => subject.dayOrder === day && subject.startTime === timeSlot
    );
  };

  const isDateInCurrentWeek = (dateStr) => {
    if (!currentWeek) return false;
    const date = new Date(dateStr);
    return date >= currentWeek.start && date <= currentWeek.end;
  };

  if (loading) return <div>Loading timetable...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="timetable-container">
      <div className="timetable-header">
        <h2>Your Timetable</h2>
        <div className="timetable-actions">
          <button 
            className={`action-button ${isEditing ? 'active' : ''}`}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Save Changes' : 'Edit Timetable'}
          </button>
          <button 
            className={`action-button ${showCalendar ? 'active' : ''}`}
            onClick={() => setShowCalendar(!showCalendar)}
          >
            {showCalendar ? 'Hide Calendar' : 'Mark Deadlines'}
          </button>
          <button 
            className="action-button"
            onClick={() => setShowDownload(!showDownload)}
          >
            {showDownload ? 'Hide Download View' : 'Show Download View'}
          </button>
        </div>
      </div>

      {showCalendar && (
        <div className="calendar-container">
          <input 
            type="date" 
            value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
          />
          {selectedDate && (
            <div className="event-input">
              <input
                type="text"
                placeholder="Enter event/deadline details"
                defaultValue={events[selectedDate.toISOString().split('T')[0]]?.text || ''}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleEventAdd(selectedDate, e.target.value);
                  }
                }}
                onBlur={(e) => handleEventAdd(selectedDate, e.target.value)}
              />
              {getDayOrderForDate(selectedDate) ? (
                <small>This will be shown on Day Order {getDayOrderForDate(selectedDate)}</small>
              ) : (
                <small className="warning">This date is either a holiday or not in the academic calendar</small>
              )}
            </div>
          )}
          <div className="events-list">
            <h3>Current Week Events</h3>
            {Object.entries(events)
              .filter(([dateStr]) => isDateInCurrentWeek(dateStr))
              .map(([dateStr, event]) => {
                const date = new Date(dateStr);
                const formattedDate = `${date.getDate()}/${date.getMonth() + 1}`;
                return (
                  <div key={dateStr} className="event-item">
                    <span>{formattedDate}</span>
                    <span>{event.text}</span>
                    <button 
                      className="delete-event"
                      onClick={() => handleEventAdd(new Date(dateStr), '')}
                    >
                      ×
                    </button>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      <div className="timetable-view">
        <div className="timetable-grid">
          <div className="time-slot"></div>
          {timeSlots.map((time, index) => (
            <div key={`time-${index}`} className="time-slot">{time}</div>
          ))}

          {days.map((day, dayIndex) => (
            <React.Fragment key={`day-${dayIndex}`}>
              <div className="time-slot day-label">{day}</div>
              {timeSlots.map((timeSlot, timeIndex) => {
                const subject = getSubjectForCell(day, timeSlot);
                const isEditable = editingCell?.day === day && editingCell?.timeSlot === timeSlot;

                return (
                  <div
                    key={`cell-${dayIndex}-${timeIndex}`}
                    className={`subject-cell ${subject?.category?.toLowerCase() || 'empty'} ${isEditing ? 'editable' : ''} ${subject?.code === 'Custom' ? 'custom' : ''} ${subject?.code === 'Event' ? 'event' : ''}`}
                    onClick={() => handleCellClick(day, timeSlot)}
                  >
                    {isEditable ? (
                      <input
                        type="text"
                        className="cell-edit-input"
                        defaultValue={subject?.name || ''}
                        autoFocus
                        onBlur={(e) => handleCellEdit(day, timeSlot, e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleCellEdit(day, timeSlot, e.target.value);
                          }
                        }}
                      />
                    ) : (
                      subject && (
                        <>
                          <div className="subject-name">{subject.name}</div>
                          <div className="subject-code">{subject.code}</div>
                        </>
                      )
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {showDownload && (
        <TimetableDownload 
          timetableData={timetableData} 
          customEntries={customEntries}
          events={events}
          currentWeek={currentWeek}
        />
      )}
    </div>
  );
};

const timeSlots = [
  '8:00 - 8:50', '8:50 - 9:40', '9:45 - 10:35', '10:40 - 11:30',
  '11:35 - 12:25', '12:30 - 1:20', '1:25 - 2:15', '2:20 - 3:10',
  '3:10 - 4:00', '4:00 - 4:50'
];

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default Timetable; 