import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Test {
  test_code: string
  max_marks: number
  obtained_marks: number | string
}

interface MarksRecord {
  course_name: string
  tests: Test[]
}

interface MarksViewProps {
  marksData: MarksRecord[]
}

export default function MarksView({ marksData }: MarksViewProps) {
  // Get unique test codes
  const allTestCodes = Array.from(new Set(marksData.flatMap((record) => record.tests.map((test) => test.test_code))))

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-xl">Marks</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue={allTestCodes[0] || "all"}>
          <div className="border-b">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
              <TabsTrigger
                value="all"
                className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                All Tests
              </TabsTrigger>
              {allTestCodes.map((testCode) => (
                <TabsTrigger
                  key={testCode}
                  value={testCode}
                  className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  {testCode}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="all" className="p-0">
            <ScrollArea className="h-[calc(100vh-300px)] md:h-[450px]">
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {marksData.map((record, index) => (
                  <MarksCard key={index} record={record} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {allTestCodes.map((testCode) => (
            <TabsContent key={testCode} value={testCode} className="p-0">
              <ScrollArea className="h-[calc(100vh-300px)] md:h-[450px]">
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {marksData
                    .filter((record) => record.tests.some((test) => test.test_code === testCode))
                    .map((record, index) => {
                      const filteredRecord = {
                        ...record,
                        tests: record.tests.filter((test) => test.test_code === testCode),
                      }
                      return <MarksCard key={index} record={filteredRecord} />
                    })}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}

function MarksCard({ record }: { record: MarksRecord }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-4">
        <div className="space-y-1">
          <CardTitle className="text-base">{record.course_name}</CardTitle>
        </div>
        <Badge variant="outline" className="h-6 w-6 p-0 text-center">
          T
        </Badge>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {record.tests.length > 0 ? (
          <div className="space-y-2">
            {record.tests.map((test, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm font-medium">{test.test_code}</span>
                <span className="text-sm">
                  {test.obtained_marks} / {test.max_marks}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">No tests conducted</p>
        )}
      </CardContent>
    </Card>
  )
}

