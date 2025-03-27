import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import './Timetable.css';

const TimetableDownload = ({ timetableData, customEntries, events, currentWeek }) => {
  const timetableRef = useRef(null);

  const handleDownload = async () => {
    if (!timetableRef.current) return;

    try {
      const canvas = await html2canvas(timetableRef.current, {
        scale: 2, // Higher quality
        backgroundColor: '#1a1a1a',
        logging: true, // Enable logging for debugging
        useCORS: true // Enable CORS for images
      });

      const link = document.createElement('a');
      link.download = 'timetable.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to download timetable:', err);
      alert('Failed to download timetable. Please try again.');
    }
  };

  const getSubjectForCell = (day, timeSlot) => {
    // Check for events first
    if (currentWeek) {
      const eventForDay = Object.entries(events).find(([dateStr, event]) => {
        const date = new Date(dateStr);
        return date >= currentWeek.start && 
               date <= currentWeek.end && 
               event.dayOrder === day;
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
    }

    // Check for custom entry
    const customEntry = customEntries[`${day}-${timeSlot}`];
    if (customEntry) return customEntry;

    // Then check regular timetable
    return timetableData.find(
      subject => subject.dayOrder === day && subject.startTime === timeSlot
    );
  };

  const timeSlots = [
    '8:00 - 8:50', '8:50 - 9:40', '9:45 - 10:35', '10:40 - 11:30',
    '11:35 - 12:25', '12:30 - 1:20', '1:25 - 2:15', '2:20 - 3:10',
    '3:10 - 4:00', '4:00 - 4:50'
  ];

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <div className="timetable-download">
      <button className="download-button" onClick={handleDownload}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download Timetable
      </button>

      <div className="timetable-grid" ref={timetableRef}>
        {/* Time slots header */}
        <div className="time-slot"></div>
        {timeSlots.map((time, index) => (
          <div key={`time-${index}`} className="time-slot">{time}</div>
        ))}

        {/* Days and cells */}
        {days.map((day, dayIndex) => (
          <React.Fragment key={`day-${dayIndex}`}>
            <div className="time-slot day-label">{day}</div>
            {timeSlots.map((timeSlot, timeIndex) => {
              const subject = getSubjectForCell(day, timeSlot);
              const cellClass = subject
                ? `subject-cell ${subject.category?.toLowerCase() || 'theory'} ${subject.code === 'Custom' ? 'custom' : ''} ${subject.code === 'Event' ? 'event' : ''}`
                : 'subject-cell empty';

              return (
                <div key={`cell-${dayIndex}-${timeIndex}`} className={cellClass}>
                  {subject && (
                    <>
                      <div className="subject-name">{subject.name}</div>
                      <div className="subject-code">{subject.code}</div>
                    </>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default TimetableDownload; 