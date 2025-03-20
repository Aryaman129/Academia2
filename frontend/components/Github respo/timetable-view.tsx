"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface TimetableViewProps {
  timetableData: Record<string, Record<string, any>>
}

export default function TimetableView({ timetableData }: TimetableViewProps) {
  const [currentDay, setCurrentDay] = useState(Object.keys(timetableData)[0] || "Day 1")
  const days = Object.keys(timetableData)

  const navigateDay = (direction: "prev" | "next") => {
    const currentIndex = days.indexOf(currentDay)
    if (direction === "prev" && currentIndex > 0) {
      setCurrentDay(days[currentIndex - 1])
    } else if (direction === "next" && currentIndex < days.length - 1) {
      setCurrentDay(days[currentIndex + 1])
    }
  }

  const handleDownload = () => {
    // In a real implementation, this would generate and download a PDF or image
    console.log("Downloading timetable...")
  }

  // Helper to determine if a slot is empty
  const isEmptySlot = (slot: any) => {
    return !slot.courses || slot.courses.length === 0
  }

  // Helper to get color class based on course name
  const getCourseColorClass = (courseName: string) => {
    if (!courseName) return "bg-muted"

    // Map course names to specific colors
    const courseColors: Record<string, string> = {
      Chemistry: "bg-amber-200 dark:bg-amber-900",
      "Calculus And Linear Algebra": "bg-amber-200 dark:bg-amber-900",
      "Programming For Problem Solving": "bg-green-200 dark:bg-green-900",
      "Philosophy Of Engineering": "bg-amber-200 dark:bg-amber-900",
      "Engineering Graphics and Design": "bg-green-200 dark:bg-green-900",
      "Electrical and Electronics Engineering": "bg-amber-200 dark:bg-amber-900",
    }

    // Return the mapped color or a default
    return courseColors[courseName] || "bg-amber-200 dark:bg-amber-900"
  }

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
        <CardTitle className="text-xl">Timetable</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            <span className="sr-only">Download</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-y bg-muted/40 px-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDay("prev")}
            disabled={days.indexOf(currentDay) === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous day</span>
          </Button>
          <span className="font-medium">{currentDay}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDay("next")}
            disabled={days.indexOf(currentDay) === days.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next day</span>
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-250px)] md:h-[500px]">
          <div className="space-y-1 p-2">
            {timetableData[currentDay] &&
              Object.entries(timetableData[currentDay])
                .sort((a, b) => {
                  // Sort by time
                  const timeA = a[0].split("-")[0].trim()
                  const timeB = b[0].split("-")[0].trim()
                  return timeA.localeCompare(timeB)
                })
                .map(([timeSlot, slotInfo]) => (
                  <div
                    key={timeSlot}
                    className={cn(
                      "rounded-md border p-3",
                      isEmptySlot(slotInfo) ? "bg-muted/20" : getCourseColorClass(slotInfo.courses[0]?.title),
                    )}
                  >
                    <div className="flex justify-between">
                      <div className="flex-1">
                        {!isEmptySlot(slotInfo) ? (
                          <div>
                            <h3 className="font-medium">
                              {slotInfo.courses.map((course: any, idx: number) => (
                                <span key={idx}>
                                  {course.title}
                                  {idx < slotInfo.courses.length - 1 && ", "}
                                </span>
                              ))}
                            </h3>
                            {slotInfo.courses[0]?.room && (
                              <p className="text-xs text-muted-foreground">Room: {slotInfo.courses[0].room}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No class scheduled</p>
                        )}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">{timeSlot}</div>
                    </div>
                  </div>
                ))}
          </div>
        </ScrollArea>

        <div className="flex justify-center border-t p-2">
          <Button variant="ghost" size="sm" onClick={() => console.log("Show classrooms")}>
            Show Classrooms
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

