import { useState } from "react";
import { useGetFacultyLoads, useGetRoomUtilization } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileBarChart, Users, DoorOpen } from "lucide-react";

const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester", "Summer"];
const YEAR_OPTIONS = ["2025-2026", "2024-2025", "2026-2027"];

const RANK_LABELS: Record<string, string> = {
  instructor: "Instructor",
  assistant_professor: "Asst. Professor",
  associate_professor: "Assoc. Professor",
  professor: "Professor",
  part_time: "Part-time",
};

function getLoadStatusBadge(status: string) {
  if (status === "overloaded") return <Badge variant="destructive" className="text-xs">Overloaded</Badge>;
  if (status === "underloaded") return <Badge variant="secondary" className="text-xs">Underloaded</Badge>;
  return <Badge className="text-xs bg-green-500/10 text-green-700 border border-green-200">Normal</Badge>;
}

function getRoomStatusBadge(status: string) {
  if (status === "highly_utilized") return <Badge className="text-xs bg-orange-500/10 text-orange-700 border border-orange-200">High Usage</Badge>;
  if (status === "underutilized") return <Badge variant="secondary" className="text-xs">Underutilized</Badge>;
  return <Badge className="text-xs bg-green-500/10 text-green-700 border border-green-200">Normal</Badge>;
}

function getProgressColor(pct: number): string {
  if (pct >= 100) return "[&>div]:bg-destructive";
  if (pct >= 80) return "[&>div]:bg-orange-500";
  return "[&>div]:bg-primary";
}

export default function Reports() {
  const [semester, setSemester] = useState("1st Semester");
  const [academicYear, setAcademicYear] = useState("2025-2026");

  const { data: facultyLoads, isLoading: loadingFaculty } = useGetFacultyLoads({ semester, academicYear });
  const { data: roomUtil, isLoading: loadingRooms } = useGetRoomUtilization({ semester, academicYear });

  const overloaded = facultyLoads?.filter(f => f.status === "overloaded").length ?? 0;
  const underloaded = facultyLoads?.filter(f => f.status === "underloaded").length ?? 0;
  const avgLoad = facultyLoads?.length
    ? Math.round(facultyLoads.reduce((a, b) => a + b.loadPercentage, 0) / facultyLoads.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Faculty loading and room utilization analytics</p>
        </div>
        <div className="flex gap-3">
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-40" data-testid="select-reports-semester"><SelectValue /></SelectTrigger>
            <SelectContent>{SEMESTER_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={academicYear} onValueChange={setAcademicYear}>
            <SelectTrigger className="w-36" data-testid="select-reports-year"><SelectValue /></SelectTrigger>
            <SelectContent>{YEAR_OPTIONS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center p-4">
          <div className="text-3xl font-bold text-primary">{avgLoad}%</div>
          <div className="text-xs text-muted-foreground mt-1">Avg. Faculty Load</div>
        </Card>
        <Card className="text-center p-4">
          <div className="text-3xl font-bold text-destructive">{overloaded}</div>
          <div className="text-xs text-muted-foreground mt-1">Overloaded Faculty</div>
        </Card>
        <Card className="text-center p-4">
          <div className="text-3xl font-bold text-muted-foreground">{underloaded}</div>
          <div className="text-xs text-muted-foreground mt-1">Underloaded Faculty</div>
        </Card>
      </div>

      <Tabs defaultValue="faculty">
        <TabsList>
          <TabsTrigger value="faculty"><Users className="h-4 w-4 mr-2" />Faculty Load</TabsTrigger>
          <TabsTrigger value="rooms"><DoorOpen className="h-4 w-4 mr-2" />Room Utilization</TabsTrigger>
        </TabsList>

        <TabsContent value="faculty" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileBarChart className="h-4 w-4" />
                Faculty Loading Report
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingFaculty ? (
                <div className="p-4 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : !facultyLoads?.length ? (
                <div className="p-10 text-center text-muted-foreground">No faculty data available</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Faculty</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rank</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Load</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Courses</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {facultyLoads.map((f) => (
                        <tr key={f.facultyId} className="hover:bg-muted/30 transition-colors" data-testid={`row-load-${f.facultyId}`}>
                          <td className="px-4 py-3 font-medium">{f.facultyName}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{RANK_LABELS[f.rank] ?? f.rank}</td>
                          <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{f.department}</Badge></td>
                          <td className="px-4 py-3 min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(100, f.loadPercentage)} className={`h-2.5 flex-1 ${getProgressColor(f.loadPercentage)}`} />
                              <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">{f.assignedUnits}/{f.maxUnits} ({f.loadPercentage}%)</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{f.courses.join(", ") || "—"}</td>
                          <td className="px-4 py-3">{getLoadStatusBadge(f.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rooms" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DoorOpen className="h-4 w-4" />
                Room Utilization Report
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingRooms ? (
                <div className="p-4 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : !roomUtil?.length ? (
                <div className="p-10 text-center text-muted-foreground">No room data available</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Room</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Building</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Capacity</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usage</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {roomUtil.map((r) => (
                        <tr key={r.roomId} className="hover:bg-muted/30 transition-colors" data-testid={`row-util-${r.roomId}`}>
                          <td className="px-4 py-3 font-mono font-medium text-primary">{r.roomNumber}</td>
                          <td className="px-4 py-3">{r.building}</td>
                          <td className="px-4 py-3 capitalize text-muted-foreground">{r.type}</td>
                          <td className="px-4 py-3">{r.capacity}</td>
                          <td className="px-4 py-3 min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <Progress value={r.utilizationRate} className="h-2.5 flex-1" />
                              <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">{r.scheduledSlots}/{r.totalSlots} ({r.utilizationRate}%)</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">{getRoomStatusBadge(r.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
