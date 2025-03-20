import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface AttendanceRecord {
  course_code: string
  course_title: string
  faculty: string
  hours_conducted: number
  hours_absent: number
  attendance_percentage: number
}

interface AttendanceViewProps {
  attendanceData: AttendanceRecord[]
}

export default function AttendanceView({ attendanceData }: AttendanceViewProps) {
  // Group courses by type (Theory/Practical)
  const theorySubjects = attendanceData.filter(
    (record) =>
      record.course_code.includes("T") || (!record.course_code.includes("P") && !record.course_code.includes("L")),
  )

  const practicalSubjects = attendanceData.filter(
    (record) => record.course_code.includes("P") || record.course_code.includes("L"),
  )

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-xl">Attendance</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-250px)] md:h-[500px]">
          <div className="space-y-4 p-4">
            {/* Theory Subjects */}
            {theorySubjects.length > 0 && (
              <div>
                {practicalSubjects.length > 0 && (
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">Theory</h3>
                )}
                <div className="space-y-3">
                  {theorySubjects.map((record, index) => (
                    <AttendanceCard key={index} record={record} />
                  ))}
                </div>
              </div>
            )}

            {/* Practical Subjects */}
            {practicalSubjects.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Practical</h3>
                <div className="space-y-3">
                  {practicalSubjects.map((record, index) => (
                    <AttendanceCard key={index} record={record} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function AttendanceCard({ record }: { record: AttendanceRecord }) {
  const isTheory =
    record.course_code.includes("T") || (!record.course_code.includes("P") && !record.course_code.includes("L"))

  const getAttendanceColor = (percentage: number) => {
    if (percentage < 75) return "text-red-500 dark:text-red-400"
    if (percentage < 85) return "text-yellow-500 dark:text-yellow-400"
    return "text-green-500 dark:text-green-400"
  }

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-5 w-5 p-0 text-center">
              {isTheory ? "T" : "P"}
            </Badge>
            <h3 className="font-medium">{record.course_title}</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Margin: {record.hours_conducted - record.hours_absent - Math.ceil(record.hours_conducted * 0.75)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium">{record.hours_conducted - record.hours_absent}</span>
            <span className="text-xs text-muted-foreground">Present</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium">{record.hours_absent}</span>
            <span className="text-xs text-muted-foreground">Absent</span>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border">
            <span className="text-xs font-medium">{record.hours_conducted}</span>
          </div>
        </div>
      </div>
      <Separator className="my-2" />
      <div className="flex items-center justify-end">
        <span className={`text-lg font-bold ${getAttendanceColor(record.attendance_percentage)}`}>
          {record.attendance_percentage}%
        </span>
      </div>
    </div>
  )
}

