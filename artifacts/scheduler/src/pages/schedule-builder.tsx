import { useState, useMemo } from "react";
import {
  useListCourses, useListFaculty, useListRooms, useListTimeslots,
  useListSchedules, useCreateSchedule, useDeleteSchedule,
  getListSchedulesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, CalendarCog, X, Check, AlertCircle, BookOpen, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

type ScheduleEntry = NonNullable<ReturnType<typeof useListSchedules>["data"]>[0];
type CourseItem = NonNullable<ReturnType<typeof useListCourses>["data"]>[0];

interface AssignDialog {
  day: string;
  startTime: string;
  timeslotId: number;
  course: CourseItem;
}

export default function ScheduleBuilder() {
  const [semester, setSemester] = useState("1st Semester");
  const [academicYear, setAcademicYear] = useState("2025-2026");
  const [search, setSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<CourseItem | null>(null);
  const [assignDialog, setAssignDialog] = useState<AssignDialog | null>(null);
  const [assignFaculty, setAssignFaculty] = useState("");
  const [assignRoom, setAssignRoom] = useState("");
  const [showScheduled, setShowScheduled] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: courses, isLoading: loadingCourses } = useListCourses();
  const { data: faculty } = useListFaculty();
  const { data: rooms } = useListRooms();
  const { data: timeslots } = useListTimeslots();
  const { data: schedules, isLoading: loadingSchedules } = useListSchedules({ semester, academicYear });
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();

  const scheduledCourseIds = useMemo(() => new Set(schedules?.map(s => s.courseId) ?? []), [schedules]);

  const unscheduledCourses = useMemo(() =>
    courses?.filter(c => !scheduledCourseIds.has(c.id)) ?? [], [courses, scheduledCourseIds]);

  const filteredCourses = useMemo(() => {
    const q = search.toLowerCase();
    const base = showScheduled ? courses : unscheduledCourses;
    return base?.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.department.toLowerCase().includes(q)
    ) ?? [];
  }, [courses, unscheduledCourses, search, showScheduled]);

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    const fallback = ["bg-cyan-50 border-cyan-300 text-cyan-900", "bg-rose-50 border-rose-300 text-rose-900"];
    let fi = 0;
    courses?.forEach(c => {
      const dept = c.department;
      if (!map.has(dept)) map.set(dept, DEPT_COLORS[dept] ?? fallback[fi++ % fallback.length]);
    });
    return map;
  }, [courses]);

  function getCell(day: string, startTime: string): ScheduleEntry[] {
    return schedules?.filter(s => s.timeslot?.day === day && s.timeslot?.startTime === startTime) ?? [];
  }

  function findTimeslot(day: string, startTime: string) {
    return timeslots?.find(t => t.day === day && t.startTime === startTime);
  }

  function isCellOccupied(day: string, startTime: string) {
    return getCell(day, startTime).length > 0;
  }

  function handleCellClick(day: string, startTime: string) {
    if (!selectedCourse) return;
    const ts = findTimeslot(day, startTime);
    if (!ts) { toast({ title: "Time slot not found", variant: "destructive" }); return; }
    setAssignFaculty("");
    setAssignRoom("");
    setAssignDialog({ day, startTime, timeslotId: ts.id, course: selectedCourse });
  }

  function handleConfirmAssign() {
    if (!assignDialog || !assignFaculty || !assignRoom) return;
    createSchedule.mutate(
      { data: { courseId: assignDialog.course.id, facultyId: Number(assignFaculty), roomId: Number(assignRoom), timeslotId: assignDialog.timeslotId, semester, academicYear } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          setAssignDialog(null);
          setSelectedCourse(null);
          toast({ title: `${assignDialog.course.code} scheduled for ${assignDialog.day} at ${TIME_LABELS[assignDialog.startTime]}` });
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Conflict detected — try a different slot or faculty";
          toast({ title: "Could not assign", description: msg, variant: "destructive" });
        },
      }
    );
  }

  function handleRemoveEntry(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    deleteSchedule.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() }); toast({ title: "Entry removed" }); },
      onError: () => toast({ title: "Error removing entry", variant: "destructive" }),
    });
  }

  const isLoading = loadingCourses || loadingSchedules;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedule Builder</h1>
          <p className="text-muted-foreground mt-1">Select a course, then click a time slot to assign it</p>
        </div>
        <div className="flex gap-2">
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-40" data-testid="select-builder-semester"><SelectValue /></SelectTrigger>
            <SelectContent>{SEMESTER_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={academicYear} onValueChange={setAcademicYear}>
            <SelectTrigger className="w-36" data-testid="select-builder-year"><SelectValue /></SelectTrigger>
            <SelectContent>{YEAR_OPTIONS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          <span className="font-medium">{scheduledCourseIds.size}</span>
          <span className="text-muted-foreground">scheduled</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
          <span className="font-medium">{unscheduledCourses.length}</span>
          <span className="text-muted-foreground">unscheduled</span>
        </div>
        {selectedCourse && (
          <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
            <CalendarCog className="h-3.5 w-3.5" />
            Placing: {selectedCourse.code}
            <button onClick={() => setSelectedCourse(null)} className="ml-1 hover:opacity-70"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>

      <div className="flex gap-4 items-start">
        {/* Course panel */}
        <div className="w-64 flex-shrink-0 space-y-3">
          <Card className="sticky top-4">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Courses
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-8 h-8 text-xs" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex gap-1 mt-2">
                <button
                  onClick={() => setShowScheduled(true)}
                  className={`flex-1 text-xs py-1 rounded text-center transition-colors ${showScheduled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >All ({courses?.length ?? 0})</button>
                <button
                  onClick={() => setShowScheduled(false)}
                  className={`flex-1 text-xs py-1 rounded text-center transition-colors ${!showScheduled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >Pending ({unscheduledCourses.length})</button>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[520px] overflow-y-auto">
              {isLoading ? (
                <div className="p-3 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : filteredCourses.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">No courses found</div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredCourses.map(c => {
                    const scheduled = scheduledCourseIds.has(c.id);
                    const isSelected = selectedCourse?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCourse(isSelected ? null : c)}
                        data-testid={`course-item-${c.id}`}
                        className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-all border ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : scheduled
                            ? "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50"
                            : "border-transparent hover:bg-muted/60 hover:border-border"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold">{c.code}</span>
                          {scheduled
                            ? <Check className="h-3 w-3 text-green-500 ml-auto flex-shrink-0" />
                            : <span className="w-1.5 h-1.5 rounded-full bg-orange-400 ml-auto flex-shrink-0" />
                          }
                        </div>
                        <div className={`truncate mt-0.5 ${isSelected ? "opacity-80" : "text-muted-foreground"}`}>{c.name}</div>
                        <div className={`text-[10px] mt-0.5 ${isSelected ? "opacity-60" : "text-muted-foreground/60"}`}>{c.section} · {c.units} units</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Grid */}
        <div className="flex-1 min-w-0 overflow-auto">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm border-collapse" style={{ minWidth: 680 }}>
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground border-b border-r w-24">
                      <Clock className="h-4 w-4" />
                    </th>
                    {DAYS.map(day => (
                      <th key={day} className="text-center px-2 py-3 font-medium text-muted-foreground border-b border-r last:border-r-0 text-xs">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map(time => (
                    <tr key={time} className="border-b last:border-b-0">
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground border-r align-top pt-3 w-24">{TIME_LABELS[time]}</td>
                      {DAYS.map(day => {
                        const cells = getCell(day, time);
                        const occupied = cells.length > 0;
                        const clickable = !!selectedCourse && !occupied;
                        const sameAsCourse = cells.some(c => c.courseId === selectedCourse?.id);
                        return (
                          <td
                            key={day}
                            onClick={() => clickable && handleCellClick(day, time)}
                            className={`px-2 py-1.5 border-r last:border-r-0 align-top transition-colors relative ${
                              clickable
                                ? "cursor-pointer bg-primary/5 hover:bg-primary/15 border-primary/20"
                                : sameAsCourse
                                ? "bg-primary/10"
                                : ""
                            }`}
                            style={{ minWidth: 100, minHeight: 80 }}
                            data-testid={`grid-cell-${day}-${time}`}
                          >
                            {clickable && (
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">Click to place</span>
                              </div>
                            )}
                            <div className="space-y-1">
                              {cells.map(cell => (
                                <div
                                  key={cell.id}
                                  className={`w-full text-left p-1.5 rounded border text-xs relative group ${colorMap.get(cell.course?.department ?? "") ?? "bg-gray-50 border-gray-200 text-gray-900"}`}
                                  data-testid={`builder-cell-${cell.id}`}
                                >
                                  <div className="font-bold">{cell.course?.code ?? "—"}</div>
                                  <div className="opacity-70 truncate text-[10px]">{cell.faculty?.name?.split(" ").slice(-1)[0] ?? "—"}</div>
                                  <div className="opacity-70">{cell.room?.roomNumber ?? "—"}</div>
                                  <button
                                    onClick={e => handleRemoveEntry(cell.id, e)}
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                                    title="Remove"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                              {!occupied && !clickable && (
                                <div className="h-16" />
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

          {/* Help text */}
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {selectedCourse
              ? `Click any highlighted empty slot to assign ${selectedCourse.code} — ${selectedCourse.name}`
              : "Select a course from the panel to start placing it on the grid"
            }
          </p>
        </div>
      </div>

      {/* Assign Dialog */}
      <Dialog open={!!assignDialog} onOpenChange={(o) => !o && setAssignDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Assign {assignDialog?.course.code}
            </DialogTitle>
          </DialogHeader>
          {assignDialog && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="font-medium">{assignDialog.course.name}</div>
                <div className="text-muted-foreground text-xs">{assignDialog.course.department} · {assignDialog.course.units} units · Section {assignDialog.course.section}</div>
                <div className="flex items-center gap-1.5 text-xs text-primary mt-2 font-medium">
                  <Clock className="h-3.5 w-3.5" />
                  {assignDialog.day} at {TIME_LABELS[assignDialog.startTime]}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Faculty</label>
                  <Select value={assignFaculty} onValueChange={setAssignFaculty}>
                    <SelectTrigger data-testid="assign-faculty"><SelectValue placeholder="Select faculty member" /></SelectTrigger>
                    <SelectContent>
                      {faculty?.map(f => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          <div>
                            <div className="font-medium">{f.name}</div>
                            <div className="text-xs text-muted-foreground">{f.department} · {f.rank.replace(/_/g, " ")}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Room</label>
                  <Select value={assignRoom} onValueChange={setAssignRoom}>
                    <SelectTrigger data-testid="assign-room"><SelectValue placeholder="Select a room" /></SelectTrigger>
                    <SelectContent>
                      {rooms?.map(r => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          <div>
                            <div className="font-medium">{r.roomNumber} — {r.building}</div>
                            <div className="text-xs text-muted-foreground capitalize">{r.type} · cap. {r.capacity}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(!assignFaculty || !assignRoom) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-2 rounded-md">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  Select both faculty and room to confirm the assignment
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>Cancel</Button>
            <Button
              onClick={handleConfirmAssign}
              disabled={!assignFaculty || !assignRoom || createSchedule.isPending}
              data-testid="button-confirm-assign"
            >
              {createSchedule.isPending ? "Assigning..." : "Confirm Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
