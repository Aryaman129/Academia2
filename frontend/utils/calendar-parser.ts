// Parse the calendar data from the structured format
export interface CalendarDay {
  date: string
  day: string
  dayOrder: string
  dayName: string
  isHoliday: boolean
}

export interface CalendarData {
  [month: string]: CalendarDay[]
}

export const parseCalendarData = (calendarText: string): CalendarData => {
  const lines = calendarText.trim().split("\n")
  const result: CalendarData = {}

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split("\t")
    if (parts.length >= 5) {
      const month = parts[0].trim()
      const day = parts[1].trim()
      const date = parts[2].trim()
      const dayOrder = parts[3].trim()
      const dayName = parts[4].trim()

      // Create month entry if it doesn't exist
      if (!result[month]) {
        result[month] = []
      }

      result[month].push({
        date,
        day,
        dayOrder,
        dayName,
        isHoliday: dayOrder === "-" || dayName === "Sat" || dayName === "Sun",
      })
    }
  }

  return result
}

// Get day order for a specific date
export const getDayOrderForDate = (date: Date, calendarData: CalendarData): string | null => {
  const dateStr = date.toISOString().split("T")[0]

  for (const month in calendarData) {
    const dayInfo = calendarData[month].find((day) => day.date === dateStr)
    if (dayInfo && dayInfo.dayOrder && dayInfo.dayOrder !== "-") {
      return dayInfo.dayOrder
    }
  }

  return null
}

// Check if a date is a holiday or weekend
export const isHolidayOrWeekend = (date: Date, calendarData: CalendarData): boolean => {
  const dateStr = date.toISOString().split("T")[0]

  for (const month in calendarData) {
    const dayInfo = calendarData[month].find((day) => day.date === dateStr)
    if (dayInfo) {
      return dayInfo.isHoliday
    }
  }

  // Default to weekend check if not found in calendar
  const day = date.getDay()
  return day === 0 || day === 6 // Sunday or Saturday
}

// Get all dates in a range
export const getDatesInRange = (startDate: Date, endDate: Date): Date[] => {
  const dates = []
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return dates
}

// Load calendar data from the server or local file
export const loadCalendarData = async (): Promise<CalendarData> => {
  try {
    // In a real implementation, this would fetch from an API
    // For now, we'll use a hardcoded sample
    const calendarText = `Month\tDay\tDate\tDO\tDayName
Mar\t1\t2025-03-01\t-\tSat
Mar\t2\t2025-03-02\t-\tSun
Mar\t3\t2025-03-03\t5\tMon
Mar\t4\t2025-03-04\t1\tTue
Mar\t5\t2025-03-05\t2\tWed
Mar\t6\t2025-03-06\t3\tThu
Mar\t7\t2025-03-07\t4\tFri
Mar\t8\t2025-03-08\t-\tSat
Mar\t9\t2025-03-09\t-\tSun
Mar\t10\t2025-03-10\t1\tMon`

    return parseCalendarData(calendarText)
  } catch (error) {
    console.error("Error loading calendar data:", error)
    return {}
  }
}

