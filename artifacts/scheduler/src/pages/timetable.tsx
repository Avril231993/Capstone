import { useState, useMemo, useRef } from "react";
import { useListSchedules, useListFaculty, useListRooms, useListCourses } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, Printer, Download, FileText, X, Filter } from "lucide-react";
import { exportToCSV, triggerPrint } from "@/lib/export";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_SLOTS = ["07:30", "09:00", "10:30", "13:00", "14:30", "16:00"];
const TIME_LABELS: Record<string, string> = {
  "07:30": "7:30 AM", "09:00": "9:00 AM", "10:30": "10:30 AM",
  "13:00": "1:00 PM", "14:30": "2:30 PM", "16:00": "4:00 PM",
};

const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester", "Summer"];
const YEAR_OPTIONS = ["2025-2026", "2024-2025", "2026-2027"];

const DEPT_COLORS: Record<string, string> = {
  "Computer Science": "bg-blue-50 border-blue-300 text-blue-900",
  "Mathematics": "bg-green-50 border-green-300 text-green-900",
  "Physics": "bg-purple-50 border-purple-300 text-purple-900",
  "English": "bg-orange-50 border-orange-300 text-orange-900",
  "Engineering": "bg-teal-50 border-teal-300 text-teal-900",
  "Business": "bg-pink-50 border-pink-300 text-pink-900",
  "Education": "bg-amber-50 border-amber-300 text-amber-900",
};

const FALLBACK_COLORS = [
  "bg-cyan-50 border-cyan-300 text-cyan-900",
  "bg-rose-50 border-rose-300 text-rose-900",
  "bg-lime-50 border-lime-300 text-lime-900",
];

type ScheduleEntry = NonNullable<ReturnType<typeof useListSchedules>["data"]>[0];

export default function Timetable() {
  const [semester, setSemester] = useState("1st Semester");
  const [academicYear, setAcademicYear] = useState("2025-2026");
  const [filterFaculty, setFilterFaculty] = useState("all");
  const [filterRoom, setFilterRoom] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterDay, setFilterDay] = useState("all");
  const [selected, setSelected] = useState<ScheduleEntry | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: schedules, isLoading } = useListSchedules({ semester, academicYear });
  const { data: faculty } = useListFaculty();
  const { data: rooms } = useListRooms();
  const { data: courses } = useListCourses();

  const departments = useMemo(() => {
    const depts = new Set(courses?.map(c => c.department) ?? []);
    return Array.from(depts).sort();
  }, [courses]);

  const activeDays = filterDay === "all" ? DAYS : [filterDay];

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    const depts = new Set(schedules?.map(s => s.course?.department ?? "").filter(Boolean));
    let fallbackIdx = 0;
    depts.forEach(dept => {
      map.set(dept, DEPT_COLORS[dept] ?? FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length]);
    });
    return map;
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    return schedules?.filter(s => {
      if (filterFaculty !== "all" && String(s.facultyId) !== filterFaculty) return false;
      if (filterRoom !== "all" && String(s.roomId) !== filterRoom) return false;
      if (filterDept !== "all" && s.course?.department !== filterDept) return false;
      if (filterDay !== "all" && s.timeslot?.day !== filterDay) return false;
      return true;
    }) ?? [];
  }, [schedules, filterFaculty, filterRoom, filterDept, filterDay]);

  const activeFilters = [filterFaculty, filterRoom, filterDept, filterDay].filter(f => f !== "all").length;

  function getCell(day: string, startTime: string) {
    return filteredSchedules.filter(
      s => s.timeslot?.day === day && s.timeslot?.startTime === startTime
    );
  }

  function clearFilters() {
    setFilterFaculty("all");
    setFilterRoom("all");
    setFilterDept("all");
    setFilterDay("all");
  }

  function handleExportCSV() {
    const fname = `schedule-${semester.replace(/\s+/g, "-")}-${academicYear}.csv`;
    exportToCSV(filteredSchedules, fname);
  }

  function handlePrint() {
    triggerPrint();
  }

  return (
    <div className="space-y-4 print:space-y-2">
      {/* Header — hidden in print */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timetable</h1>
          <p className="text-muted-foreground mt-1">Weekly schedule grid view</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-40" data-testid="select-timetable-semester"><SelectValue /></SelectTrigger>
            <SelectContent>{SEMESTER_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={academicYear} onValueChange={setAcademicYear}>
            <SelectTrigger className="w-36" data-testid="select-timetable-year"><SelectValue /></SelectTrigger>
            <SelectContent>{YEAR_OPTIONS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Separator orientation="vertical" className="h-8" />
          <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)} data-testid="button-toggle-filters">
            <Filter className="h-4 w-4 mr-1.5" />
            Filters
            {activeFilters > 0 && (
              <Badge className="ml-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]">{activeFilters}</Badge>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-1.5" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print">
            <Printer className="h-4 w-4 mr-1.5" />Print
          </Button>
        </div>
      </div>

      {/* Print header — only visible when printing */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">Class Schedule — {semester} {academicYear}</h1>
        {filterFaculty !== "all" && <p className="text-sm mt-1">Faculty: {faculty?.find(f => String(f.id) === filterFaculty)?.name}</p>}
        {filterRoom !== "all" && <p className="text-sm">Room: {rooms?.find(r => String(r.id) === filterRoom)?.roomNumber}</p>}
        {filterDept !== "all" && <p className="text-sm">Department: {filterDept}</p>}
        {filterDay !== "all" && <p className="text-sm">Day: {filterDay}</p>}
        <p className="text-xs text-gray-500 mt-1">Generated on {new Date().toLocaleDateString()}</p>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card className="print:hidden">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Filter className="h-3.5 w-3.5" /> Filter by:
              </div>
              <Select value={filterDept} onValueChange={setFilterDept}>
                <SelectTrigger className="w-44 h-8 text-xs" data-testid="filter-department">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterFaculty} onValueChange={setFilterFaculty}>
                <SelectTrigger className="w-48 h-8 text-xs" data-testid="filter-faculty">
                  <SelectValue placeholder="All Faculty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Faculty</SelectItem>
                  {faculty?.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterRoom} onValueChange={setFilterRoom}>
                <SelectTrigger className="w-44 h-8 text-xs" data-testid="filter-room">
                  <SelectValue placeholder="All Rooms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  {rooms?.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.roomNumber} — {r.building}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterDay} onValueChange={setFilterDay}>
                <SelectTrigger className="w-36 h-8 text-xs" data-testid="filter-day">
                  <SelectValue placeholder="All Days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-muted-foreground">
                  <X className="h-3.5 w-3.5 mr-1" />Clear
                </Button>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {filteredSchedules.length} of {schedules?.length ?? 0} entries
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      {Object.keys(colorMap).length > 0 && (
        <div className="flex flex-wrap gap-2 print:mb-3">
          {Array.from(colorMap.entries()).map(([dept, color]) => (
            <span key={dept} className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${color}`}>{dept}</span>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3 print:hidden">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <div ref={printRef}>
          <Card className="overflow-auto print:overflow-visible print:border print:rounded-none print:shadow-none">
            <CardContent className="p-0">
              <table className="w-full text-sm border-collapse print:text-xs" style={{ minWidth: filterDay !== "all" ? 400 : 800 }}>
                <thead>
                  <tr className="bg-muted/50 print:bg-gray-100">
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground border-b border-r w-24 print:text-gray-600">Time</th>
                    {activeDays.map(day => (
                      <th key={day} className="text-center px-3 py-3 font-medium text-muted-foreground border-b border-r last:border-r-0 print:text-gray-600">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map(time => (
                    <tr key={time} className="border-b last:border-b-0">
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground border-r align-top pt-3 w-24 print:text-gray-500">
                        {TIME_LABELS[time] ?? time}
                      </td>
                      {activeDays.map(day => {
                        const cells = getCell(day, time);
                        return (
                          <td key={day} className="px-2 py-1.5 border-r last:border-r-0 align-top min-h-[80px] print:min-h-[60px]" style={{ minWidth: 120 }}>
                            <div className="space-y-1">
                              {cells.map(cell => (
                                <button
                                  key={cell.id}
                                  onClick={() => setSelected(cell)}
                                  className={`w-full text-left p-1.5 rounded border text-xs hover:opacity-90 transition-opacity print:pointer-events-none print:p-1 ${colorMap.get(cell.course?.department ?? "") ?? "bg-gray-50 border-gray-200 text-gray-900"}`}
                                  data-testid={`cell-schedule-${cell.id}`}
                                >
                                  <div className="font-bold">{cell.course?.code ?? "—"}</div>
                                  <div className="opacity-75 truncate text-[10px] print:hidden">{cell.course?.name}</div>
                                  <div className="opacity-70 truncate">{cell.faculty?.name?.split(" ").slice(-1)[0] ?? "—"}</div>
                                  <div className="opacity-70">{cell.room?.roomNumber ?? "—"}</div>
                                </button>
                              ))}
                              {cells.length === 0 && (
                                <div className="h-16 print:h-12" />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {filteredSchedules.length === 0 && !isLoading && (
        <div className="text-center py-14 text-muted-foreground print:hidden">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No entries match the current filters</p>
          {activeFilters > 0 && (
            <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">Clear filters</Button>
          )}
        </div>
      )}

      {/* Footer for print */}
      <div className="hidden print:block mt-4 text-xs text-gray-400 border-t pt-2">
        RegiSync — Intelligent Class Scheduling System &nbsp;|&nbsp; {semester} {academicYear}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.course?.code} — {selected?.course?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground mb-0.5">Faculty</div><div className="font-medium">{selected.faculty?.name ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground mb-0.5">Room</div><div className="font-medium">{selected.room?.roomNumber ?? "—"} — {selected.room?.building ?? ""}</div></div>
                <div><div className="text-xs text-muted-foreground mb-0.5">Day & Time</div><div className="font-medium">{selected.timeslot?.day} {selected.timeslot?.startTime}–{selected.timeslot?.endTime}</div></div>
                <div><div className="text-xs text-muted-foreground mb-0.5">Enrollment</div><div className="font-medium">{selected.course?.enrollmentCount ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground mb-0.5">Department</div><div className="font-medium">{selected.course?.department ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground mb-0.5">Units</div><div className="font-medium">{selected.course?.units ?? "—"}</div></div>
              </div>
              {selected.course?.description && (
                <div className="pt-1 border-t">
                  <div className="text-xs text-muted-foreground mb-0.5">Description</div>
                  <div className="text-muted-foreground text-xs">{selected.course.description}</div>
                </div>
              )}
              <div className="flex justify-end pt-1">
                <Badge variant="outline" className="text-xs font-mono">{selected.semester} {selected.academicYear}</Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
