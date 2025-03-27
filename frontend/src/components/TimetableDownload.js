import React, { useRef } from 'react';
import { jsPDF } from 'jspdf';
import './Timetable.css';

const TimetableDownload = ({ timetableData, customEntries, events, currentWeek }) => {
  const timetableRef = useRef(null);

  const handleDownload = async () => {
    if (!timetableRef.current) return;

    try {
      // Create a PDF document
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Define table dimensions
      const margin = 15;
      const cellWidth = (pdf.internal.pageSize.width - margin * 2) / (timeSlots.length + 1);
      const cellHeight = 15;
      const startX = margin;
      const startY = margin;
      
      // Set title
      pdf.setFontSize(18);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Weekly Timetable', pdf.internal.pageSize.width / 2, startY - 5, { align: 'center' });
      
      // Draw header row
      pdf.setFillColor(45, 55, 72);
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      
      // Empty top-left cell
      pdf.rect(startX, startY, cellWidth, cellHeight, 'F');
      
      // Time slot header cells
      timeSlots.forEach((time, index) => {
        const x = startX + cellWidth * (index + 1);
        pdf.rect(x, startY, cellWidth, cellHeight, 'F');
        pdf.text(time, x + cellWidth / 2, startY + cellHeight / 2, { align: 'center', baseline: 'middle' });
      });
      
      // Draw day rows
      dayOrders.forEach((dayOrder, dayIndex) => {
        const rowY = startY + cellHeight * (dayIndex + 1);
        
        // Day label cell
        pdf.setFillColor(45, 55, 72);
        pdf.setTextColor(255, 255, 255);
        pdf.rect(startX, rowY, cellWidth, cellHeight, 'F');
        pdf.text(getDayFromDayOrder(dayOrder), startX + cellWidth / 2, rowY + cellHeight / 2, { align: 'center', baseline: 'middle' });
        
        // Subject cells
        timeSlots.forEach((timeSlot, timeIndex) => {
          const x = startX + cellWidth * (timeIndex + 1);
          const subject = getSubjectForCell(dayOrder, timeSlot);
          
          // Set appropriate fill color based on subject type
          if (subject) {
            if (subject.code === 'Event') {
              pdf.setFillColor(41, 128, 185, 0.3); // Blue for events
            } else if (subject.code === 'Custom') {
              pdf.setFillColor(142, 68, 173, 0.3); // Purple for custom
            } else if (subject.category?.toLowerCase() === 'practical') {
              pdf.setFillColor(40, 167, 69, 0.15); // Green for practical
            } else {
              pdf.setFillColor(255, 193, 7, 0.15); // Yellow for theory
            }
          } else {
            pdf.setFillColor(240, 240, 240); // Light gray for empty cells
          }
          
          // Draw cell background
          pdf.rect(x, rowY, cellWidth, cellHeight, 'F');
          
          // Draw cell content
          if (subject) {
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(8);
            pdf.text(subject.name || '', x + cellWidth / 2, rowY + cellHeight / 2 - 3, { align: 'center', baseline: 'middle' });
            pdf.text(subject.code || '', x + cellWidth / 2, rowY + cellHeight / 2 + 3, { align: 'center', baseline: 'middle' });
          }
          
          // Draw cell border
          pdf.setDrawColor(0);
          pdf.rect(x, rowY, cellWidth, cellHeight);
        });
      });
      
      // Save the PDF
      pdf.save('timetable.pdf');
    } catch (err) {
      console.error('Failed to download timetable:', err);
      alert('Failed to download timetable. Please try again.');
    }
  };

  const getDayFromDayOrder = (dayOrder) => {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][dayOrder - 1] || '';
  };

  const getSubjectForCell = (dayOrder, timeSlot) => {
    const day = getDayFromDayOrder(dayOrder);
    
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
      subject => subject.day_order === dayOrder && subject.startTime === timeSlot
    );
  };

  const timeSlots = [
    '8:00 - 8:50', '8:50 - 9:40', '9:45 - 10:35', '10:40 - 11:30',
    '11:35 - 12:25', '12:30 - 1:20', '1:25 - 2:15', '2:20 - 3:10',
    '3:10 - 4:00', '4:00 - 4:50'
  ];

  const dayOrders = [1, 2, 3, 4, 5];

  return (
    <div className="timetable-download">
      <button className="download-button" onClick={handleDownload}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download Timetable
      </button>

      <div className="timetable-grid" ref={timetableRef}>
        <div className="time-slot"></div>
        {timeSlots.map((time, index) => (
          <div key={`time-${index}`} className="time-slot">{time}</div>
        ))}

        {dayOrders.map((dayOrder, dayIndex) => (
          <React.Fragment key={`day-${dayIndex}`}>
            <div className="time-slot day-label">{getDayFromDayOrder(dayOrder)}</div>
            {timeSlots.map((timeSlot, timeIndex) => {
              const subject = getSubjectForCell(dayOrder, timeSlot);
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