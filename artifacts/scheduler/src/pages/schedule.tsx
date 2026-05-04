import { useState } from "react";
import { useListSchedules, useCreateSchedule, useDeleteSchedule, useListCourses, useListFaculty, useListRooms, useListTimeslots, getListSchedulesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, CalendarPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester", "Summer"];
const YEAR_OPTIONS = ["2025-2026", "2024-2025", "2026-2027"];

const scheduleSchema = z.object({
  courseId: z.coerce.number().int().min(1, "Course is required"),
  facultyId: z.coerce.number().int().min(1, "Faculty is required"),
  roomId: z.coerce.number().int().min(1, "Room is required"),
  timeslotId: z.coerce.number().int().min(1, "Time slot is required"),
  semester: z.string().min(1),
  academicYear: z.string().min(1),
});
type ScheduleForm = z.infer<typeof scheduleSchema>;

export default function Schedule() {
  const [semester, setSemester] = useState("1st Semester");
  const [academicYear, setAcademicYear] = useState("2025-2026");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schedules, isLoading } = useListSchedules({ semester, academicYear });
  const { data: courses } = useListCourses();
  const { data: faculty } = useListFaculty();
  const { data: rooms } = useListRooms();
  const { data: timeslots } = useListTimeslots();
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();

  const form = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { courseId: 0, facultyId: 0, roomId: 0, timeslotId: 0, semester, academicYear },
  });

  function openCreate() {
    form.reset({ courseId: 0, facultyId: 0, roomId: 0, timeslotId: 0, semester, academicYear });
    setDialogOpen(true);
  }

  function onSubmit(data: ScheduleForm) {
    createSchedule.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
        setDialogOpen(false);
        toast({ title: "Schedule entry created" });
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Conflict detected";
        toast({ title: "Error creating schedule", description: msg, variant: "destructive" });
      },
    });
  }

  function handleDelete(id: number) {
    deleteSchedule.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() }); toast({ title: "Entry deleted" }); },
      onError: () => toast({ title: "Error deleting entry", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground mt-1">Manually manage schedule entries</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-schedule"><Plus className="h-4 w-4 mr-2" />Add Entry</Button>
      </div>

      <div className="flex gap-3">
        <Select value={semester} onValueChange={setSemester}>
          <SelectTrigger className="w-40" data-testid="select-schedule-semester"><SelectValue /></SelectTrigger>
          <SelectContent>{SEMESTER_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={academicYear} onValueChange={setAcademicYear}>
          <SelectTrigger className="w-36" data-testid="select-schedule-year"><SelectValue /></SelectTrigger>
          <SelectContent>{YEAR_OPTIONS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarPlus className="h-4 w-4" />
            {isLoading ? "Loading..." : `${schedules?.length ?? 0} schedule entries`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !schedules?.length ? (
            <div className="p-12 text-center text-muted-foreground">
              <CalendarPlus className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No schedule entries</p>
              <p className="text-sm mt-1">Add entries manually or use AI Generate</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Course</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Faculty</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Room</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time Slot</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-schedule-${s.id}`}>
                      <td className="px-4 py-3">
                        <div className="font-mono font-medium text-primary">{s.course?.code ?? s.courseId}</div>
                        <div className="text-xs text-muted-foreground">{s.course?.name ?? ""}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.faculty?.name ?? s.facultyId}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono">{s.room?.roomNumber ?? s.roomId}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{s.timeslot?.label ?? s.timeslotId}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)} data-testid={`button-delete-schedule-${s.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Schedule Entry</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="courseId" render={({ field }) => (
                <FormItem><FormLabel>Course</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                    <FormControl><SelectTrigger data-testid="select-schedule-course"><SelectValue placeholder="Select course" /></SelectTrigger></FormControl>
                    <SelectContent>{courses?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.code} — {c.name} ({c.section})</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="facultyId" render={({ field }) => (
                <FormItem><FormLabel>Faculty</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                    <FormControl><SelectTrigger data-testid="select-schedule-faculty"><SelectValue placeholder="Select faculty" /></SelectTrigger></FormControl>
                    <SelectContent>{faculty?.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="roomId" render={({ field }) => (
                <FormItem><FormLabel>Room</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                    <FormControl><SelectTrigger data-testid="select-schedule-room"><SelectValue placeholder="Select room" /></SelectTrigger></FormControl>
                    <SelectContent>{rooms?.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.roomNumber} — {r.building} (cap: {r.capacity})</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="timeslotId" render={({ field }) => (
                <FormItem><FormLabel>Time Slot</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                    <FormControl><SelectTrigger data-testid="select-schedule-timeslot"><SelectValue placeholder="Select time slot" /></SelectTrigger></FormControl>
                    <SelectContent>{timeslots?.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.label}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="semester" render={({ field }) => (
                  <FormItem><FormLabel>Semester</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{SEMESTER_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select></FormItem>
                )} />
                <FormField control={form.control} name="academicYear" render={({ field }) => (
                  <FormItem><FormLabel>Academic Year</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{YEAR_OPTIONS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select></FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createSchedule.isPending} data-testid="button-submit-schedule">Create Entry</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
