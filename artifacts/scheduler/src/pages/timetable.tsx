import { useState } from "react";
import { useListSchedules, getListSchedulesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_SLOTS = ["07:30", "09:00", "10:30", "13:00", "14:30", "16:00"];

const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester", "Summer"];
const YEAR_OPTIONS = ["2025-2026", "2024-2025", "2026-2027"];

const COLORS = [
  "bg-blue-50 border-blue-200 text-blue-900",
  "bg-green-50 border-green-200 text-green-900",
  "bg-purple-50 border-purple-200 text-purple-900",
  "bg-orange-50 border-orange-200 text-orange-900",
  "bg-pink-50 border-pink-200 text-pink-900",
  "bg-teal-50 border-teal-200 text-teal-900",
];

export default function Timetable() {
  const [semester, setSemester] = useState("1st Semester");
  const [academicYear, setAcademicYear] = useState("2025-2026");
  const [selected, setSelected] = useState<NonNullable<ReturnType<typeof useListSchedules>["data"]>[0] | null>(null);

  const { data: schedules, isLoading } = useListSchedules({ semester, academicYear });

  const colorMap = new Map<number, string>();
  schedules?.forEach((s, i) => {
    if (!colorMap.has(s.courseId)) colorMap.set(s.courseId, COLORS[colorMap.size % COLORS.length]);
  });

  function getCell(day: string, startTime: string) {
    return schedules?.filter(
      (s) => s.timeslot?.day === day && s.timeslot?.startTime === startTime
    ) ?? [];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timetable</h1>
          <p className="text-muted-foreground mt-1">Weekly schedule grid view</p>
        </div>
        <div className="flex gap-3">
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-40" data-testid="select-timetable-semester"><SelectValue /></SelectTrigger>
            <SelectContent>{SEMESTER_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={academicYear} onValueChange={setAcademicYear}>
            <SelectTrigger className="w-36" data-testid="select-timetable-year"><SelectValue /></SelectTrigger>
            <SelectContent>{YEAR_OPTIONS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <Card className="overflow-auto">
          <CardContent className="p-0">
            <table className="w-full text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground border-b border-r w-24">Time</th>
                  {DAYS.map(day => (
                    <th key={day} className="text-center px-3 py-3 font-medium text-muted-foreground border-b border-r last:border-r-0">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((time) => (
                  <tr key={time} className="border-b last:border-b-0">
                    <td className="px-3 py-2 text-xs font-mono text-muted-foreground border-r align-top pt-3 w-24">{time}</td>
                    {DAYS.map(day => {
                      const cells = getCell(day, time);
                      return (
                        <td key={day} className="px-2 py-1.5 border-r last:border-r-0 align-top min-h-[80px] min-w-[120px]">
                          <div className="space-y-1">
                            {cells.map(cell => (
                              <button
                                key={cell.id}
                                onClick={() => setSelected(cell)}
                                className={`w-full text-left p-1.5 rounded border text-xs hover:opacity-90 transition-opacity ${colorMap.get(cell.courseId) ?? COLORS[0]}`}
                                data-testid={`cell-schedule-${cell.id}`}
                              >
                                <div className="font-semibold">{cell.course?.code ?? "—"}</div>
                                <div className="opacity-70 truncate">{cell.faculty?.name?.split(" ").slice(-1)[0] ?? "—"}</div>
                                <div className="opacity-70">{cell.room?.roomNumber ?? "—"}</div>
                              </button>
                            ))}
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
      )}

      {schedules?.length === 0 && !isLoading && (
        <div className="text-center py-16 text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No schedule entries for this term</p>
          <p className="text-sm mt-1">Add schedule entries or use AI Generate to populate the timetable</p>
        </div>
      )}

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
                <div><div className="text-xs text-muted-foreground mb-0.5">Description</div><div className="text-muted-foreground">{selected.course.description}</div></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
