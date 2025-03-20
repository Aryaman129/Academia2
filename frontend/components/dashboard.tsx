"use client"

import { useState, useEffect, useCallback } from "react"
import { Calendar, Clock, BookOpen, BarChart3, Menu, X, RefreshCw } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useMediaQuery } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { dataAPI } from "@/utils/api-client"
import { toast } from "@/hooks/use-toast"

import TimetableView from "./timetable-view"
import AttendanceView from "./attendance-view"
import MarksView from "./marks-view"
import AttendancePrediction from "./attendance-prediction"
import ThemeToggle from "./theme-toggle"
import { loadCalendarData } from "@/utils/calendar-parser"

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userData, setUserData] = useState({
    name: "Student",
    regNo: "",
    email: user?.email || "student@srmist.edu.in",
    batch: "",
  })
  const [attendanceData, setAttendanceData] = useState([])
  const [timetableData, setTimetableData] = useState({})
  const [marksData, setMarksData] = useState([])
  const [calendarData, setCalendarData] = useState({})
  const isMobile = useMediaQuery("(max-width: 768px)")

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Load calendar data
      const calendar = await loadCalendarData()
      setCalendarData(calendar)

      // Fetch attendance data
      const attendanceResponse = await dataAPI.getAttendance()
      if (attendanceResponse.data.success) {
        const records = attendanceResponse.data.attendance.records || []
        setAttendanceData(records)

        // Set registration number if available
        if (attendanceResponse.data.attendance.registration_number) {
          setUserData((prev) => ({
            ...prev,
            regNo: attendanceResponse.data.attendance.registration_number,
          }))
        }
      }

      // Fetch timetable data
      const timetableResponse = await dataAPI.getTimetable()
      if (timetableResponse.data.success) {
        setTimetableData(timetableResponse.data.timetable || {})

        // Set batch if available
        if (timetableResponse.data.batch) {
          setUserData((prev) => ({
            ...prev,
            batch: timetableResponse.data.batch,
          }))
        }

        // Set personal details if available
        if (timetableResponse.data.personal_details) {
          const details = timetableResponse.data.personal_details
          setUserData((prev) => ({
            ...prev,
            name: details.Name || prev.name,
            regNo: details["Registration Number"] || prev.regNo,
          }))
        }
      }

      // Fetch marks data
      const marksResponse = await dataAPI.getMarks()
      if (marksResponse.data.success) {
        setMarksData(marksResponse.data.marks.records || [])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  // Refresh data with password
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const password = localStorage.getItem("userPassword")
      if (!password) {
        toast({
          title: "Error",
          description: "Password not available. Please log in again.",
          variant: "destructive",
        })
        return
      }

      // Refresh timetable data
      await dataAPI.refreshTimetable(password)

      // Poll for completion
      let completed = false
      let attempts = 0

      while (!completed && attempts < 30) {
        attempts++
        const statusResponse = await dataAPI.getTimetableStatus()

        if (statusResponse.data.success && statusResponse.data.status.status === "completed") {
          completed = true

          // Fetch all data again
          await fetchData()

          toast({
            title: "Success",
            description: "Data refreshed successfully!",
            variant: "default",
          })
        } else if (statusResponse.data.status.status === "failed") {
          toast({
            title: "Error",
            description: "Failed to refresh data. Please try again.",
            variant: "destructive",
          })
          break
        }

        // Wait 2 seconds before polling again
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      if (!completed) {
        toast({
          title: "Timeout",
          description: "Refresh operation timed out. Data may still be updating.",
          variant: "default",
        })
      }
    } catch (error) {
      console.error("Error refreshing data:", error)
      toast({
        title: "Error",
        description: "Failed to refresh data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setRefreshing(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle menu</span>
        </Button>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-background transition-transform md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <h1 className="text-xl font-bold">Academia</h1>
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
              <span className="sr-only">Close menu</span>
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-1 p-4">
          <div className="mb-4 space-y-1">
            <p className="text-sm font-medium">{userData.name}</p>
            <p className="text-xs text-muted-foreground">{userData.regNo}</p>
            <p className="text-xs text-muted-foreground">{userData.email}</p>
            {userData.batch && (
              <Badge variant="outline" className="mt-1">
                {userData.batch}
              </Badge>
            )}
          </div>
          <Separator className="my-2" />
          <Button variant="ghost" className="justify-start" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {refreshing ? "Refreshing..." : "Refresh Data"}
          </Button>
          <Button variant="ghost" className="justify-start md:hidden" onClick={logout}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
        <div className="mt-auto flex items-center justify-between p-4">
          <ThemeToggle />
          <p className="text-xs text-muted-foreground">v1.0.0</p>
        </div>
      </div>

      {/* Main Content */}
      <main className={cn("flex-1 md:ml-64")}>
        <div className="container mx-auto p-4">
          <Tabs defaultValue="timetable" className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="timetable" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Timetable</span>
                </TabsTrigger>
                <TabsTrigger value="attendance" className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Attendance</span>
                </TabsTrigger>
                <TabsTrigger value="marks" className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Marks</span>
                </TabsTrigger>
                <TabsTrigger value="prediction" className="flex items-center gap-1">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Predict</span>
                </TabsTrigger>
              </TabsList>
              <div className="hidden md:flex md:items-center md:gap-2">
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
                <Button variant="default" size="sm" onClick={logout}>
                  Logout
                </Button>
              </div>
            </div>

            <TabsContent value="timetable" className="space-y-4">
              <TimetableView timetableData={timetableData} />
            </TabsContent>

            <TabsContent value="attendance" className="space-y-4">
              <AttendanceView attendanceData={attendanceData} />
            </TabsContent>

            <TabsContent value="marks" className="space-y-4">
              <MarksView marksData={marksData} />
            </TabsContent>

            <TabsContent value="prediction" className="space-y-4">
              <AttendancePrediction
                attendanceData={attendanceData}
                timetableData={timetableData}
                calendarData={calendarData}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}

