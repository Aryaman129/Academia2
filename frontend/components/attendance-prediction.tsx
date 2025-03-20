"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar } from "@/components/ui/calendar"
import type { DateRange } from "react-day-picker"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { calculateAttendance } from "@/utils/attendance-calculator"
import { getDayOrderForDate, isHolidayOrWeekend, getDatesInRange, type CalendarData } from "@/utils/calendar-parser"

interface AttendanceRecord {
  course_code: string
  course_title: string
  faculty: string
  hours_conducted: number
  hours_absent: number
  attendance_percentage: number
  slot?: string
}

interface AttendancePredictionProps {
  attendanceData: AttendanceRecord[]
  timetableData: Record<string, Record<string, any>>
  calendarData: CalendarData
}

export default function AttendancePrediction({
  attendanceData,
  timetableData,
  calendarData,
}: AttendancePredictionProps) {
  const [selectedCourse, setSelectedCourse] = useState<string>("")
  const [courseData, setCourseData] = useState<AttendanceRecord | null>(null)
  const [prediction, setPrediction] = useState<any>(null)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [additionalAbsences, setAdditionalAbsences] = useState<number>(0)
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [missedClasses, setMissedClasses] = useState<number>(0)

  // When course is selected, set course data and initial prediction
  useEffect(() => {
    if (selectedCourse) {
      const course = attendanceData.find((record) => record.course_title === selectedCourse)
      setCourseData(course || null)

      if (course) {
        const result = calculateAttendance(course.hours_conducted, course.hours_conducted - course.hours_absent)
        setPrediction(result)
      }
    }
  }, [selectedCourse, attendanceData])

  // When date range changes, update selected dates
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      const dates = getDatesInRange(dateRange.from, dateRange.to)
      setSelectedDates(dates)
    } else {
      setSelectedDates([])
    }
  }, [dateRange])

  // Check if a course is scheduled on a specific day order
  const isCourseScheduledOnDayOrder = (courseTitle: string, dayOrder: string) => {
    const dayKey = `Day ${dayOrder}`

    if (!timetableData[dayKey]) return false

    // Check each time slot in this day
    for (const timeSlot in timetableData[dayKey]) {
      const slotInfo = timetableData[dayKey][timeSlot]
      if (
        slotInfo.courses &&
        slotInfo.courses.some((c: any) => c.title === courseTitle || c.code === courseData?.course_code)
      ) {
        return true
      }
    }

    return false
  }

  // Calculate missed classes based on selected dates and day orders
  useEffect(() => {
    if (!courseData || !selectedDates.length) {
      setMissedClasses(0)
      return
    }

    let missed = 0

    // For each selected date
    for (const date of selectedDates) {
      // Skip holidays and weekends
      if (isHolidayOrWeekend(date, calendarData)) {
        continue
      }

      // Get day order for this date
      const dayOrder = getDayOrderForDate(date, calendarData)

      // If this date has a day order and the course has classes on this day order
      if (dayOrder && isCourseScheduledOnDayOrder(courseData.course_title, dayOrder)) {
        missed++
      }
    }

    setMissedClasses(missed)
  }, [selectedDates, courseData, timetableData, calendarData])

  // Calculate future attendance based on missed classes
  useEffect(() => {
    if (courseData) {
      // Total missed classes = selected dates + additional absences
      const totalMissed = missedClasses + Number(additionalAbsences)

      // Assume 10 more classes in the future
      const futureClasses = 10
      const totalClasses = courseData.hours_conducted + futureClasses
      const attendedClasses = courseData.hours_conducted - courseData.hours_absent - totalMissed

      // Calculate new attendance
      const result = calculateAttendance(totalClasses, attendedClasses)
      setPrediction(result)
    }
  }, [courseData, missedClasses, additionalAbsences])

  // Helper function to get day order for a date (for display)
  const getDayOrderDisplay = (date: Date) => {
    const dayOrder = getDayOrderForDate(date, calendarData)
    return dayOrder ? `D.O ${dayOrder}` : null
  }

  // Helper function to check if a date is a holiday or has no day order
  const isDateDisabled = (date: Date) => {
    return isHolidayOrWeekend(date, calendarData)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Attendance Predictor</CardTitle>
          <CardDescription>Select a course and plan your leaves to see how it affects your attendance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="course">Select Course</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger id="course">
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {attendanceData.map((record, index) => (
                    <SelectItem key={index} value={record.course_title}>
                      {record.course_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {courseData && (
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Current Attendance</p>
                      <p
                        className={cn(
                          "text-2xl font-bold",
                          courseData.attendance_percentage < 75
                            ? "text-red-500 dark:text-red-400"
                            : "text-green-500 dark:text-green-400",
                        )}
                      >
                        {courseData.attendance_percentage}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Classes Attended</p>
                      <p className="text-2xl font-bold">
                        {courseData.hours_conducted - courseData.hours_absent}/{courseData.hours_conducted}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additional">Additional Absences</Label>
                  <Input
                    id="additional"
                    type="number"
                    min="0"
                    value={additionalAbsences}
                    onChange={(e) => setAdditionalAbsences(Number.parseInt(e.target.value) || 0)}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Add any additional absences not marked on the calendar
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Selected Date Range</Label>
                    {dateRange?.from && dateRange?.to && (
                      <Badge variant="outline">
                        {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Classes missed based on Day Order: <span className="font-medium">{missedClasses}</span>
                  </p>
                </div>

                <Separator />

                {prediction && (
                  <div className="space-y-2">
                    <h3 className="font-medium">Prediction Results</h3>

                    <div className="rounded-md bg-muted p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium">Predicted Attendance</p>
                          <p
                            className={cn(
                              "text-2xl font-bold",
                              Number(prediction.currentPercentage) < 75
                                ? "text-red-500 dark:text-red-400"
                                : "text-green-500 dark:text-green-400",
                            )}
                          >
                            {prediction.currentPercentage}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Status</p>
                          <p
                            className={cn(
                              "text-lg font-medium",
                              prediction.isAbove75
                                ? "text-green-500 dark:text-green-400"
                                : "text-red-500 dark:text-red-400",
                            )}
                          >
                            {prediction.isAbove75 ? "Safe" : "At Risk"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-md border p-3">
                        <p className="text-sm font-medium">Classes Needed</p>
                        <p className="text-xl font-bold">{prediction.classesNeeded}</p>
                        <p className="text-xs text-muted-foreground">To reach 75% attendance</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm font-medium">Can Skip</p>
                        <p className="text-xl font-bold">{prediction.canSkip}</p>
                        <p className="text-xs text-muted-foreground">While staying above 75%</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Select Leave Dates</CardTitle>
          <CardDescription>
            Select a date range for your planned leaves. Only days with Day Order (D.O) that match your course schedule
            will affect attendance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="p-1">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                disabled={isDateDisabled}
                components={{
                  DayContent: (props) => {
                    const dayOrder = getDayOrderDisplay(props.date)
                    return (
                      <div className="flex flex-col items-center justify-center">
                        <div>{props.date.getDate()}</div>
                        {dayOrder && <div className="text-[8px] text-muted-foreground">{dayOrder}</div>}
                      </div>
                    )
                  },
                }}
              />
            </div>
          </ScrollArea>

          <div className="mt-4">
            <p className="text-sm">
              Selected Dates: <span className="font-medium">{selectedDates.length}</span>
            </p>
            {selectedDates.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium mb-1">Date Summary:</p>
                <div className="rounded-md border p-3 max-h-32 overflow-y-auto">
                  <ul className="text-xs space-y-1">
                    {selectedDates.map((date, index) => {
                      const dayOrder = getDayOrderDisplay(date)
                      const isAffected =
                        dayOrder &&
                        courseData &&
                        isCourseScheduledOnDayOrder(courseData.course_title, dayOrder.replace("D.O ", ""))

                      return (
                        <li key={index} className="flex items-center justify-between">
                          <span>{date.toLocaleDateString()}</span>
                          <span className="flex items-center gap-1">
                            {dayOrder && <span>{dayOrder}</span>}
                            {isAffected ? (
                              <Badge variant="destructive" className="text-[8px] px-1 py-0">
                                Affects
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[8px] px-1 py-0">
                                No Effect
                              </Badge>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

