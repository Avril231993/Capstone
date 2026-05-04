export type ScheduleRow = {
  id: number;
  course?: { code?: string; name?: string; department?: string; units?: number; section?: string; enrollmentCount?: number } | null;
  faculty?: { name?: string; email?: string } | null;
  room?: { roomNumber?: string; building?: string; type?: string; capacity?: number } | null;
  timeslot?: { day?: string; startTime?: string; endTime?: string; label?: string } | null;
  semester?: string;
  academicYear?: string;
};

export function exportToCSV(schedules: ScheduleRow[], filename = "schedule.csv") {
  const headers = [
    "ID", "Course Code", "Course Name", "Department", "Units", "Section", "Enrollment",
    "Faculty", "Faculty Email", "Room", "Building", "Room Type", "Room Capacity",
    "Day", "Start Time", "End Time", "Semester", "Academic Year"
  ];

  const rows = schedules.map(s => [
    s.id,
    s.course?.code ?? "",
    s.course?.name ?? "",
    s.course?.department ?? "",
    s.course?.units ?? "",
    s.course?.section ?? "",
    s.course?.enrollmentCount ?? "",
    s.faculty?.name ?? "",
    s.faculty?.email ?? "",
    s.room?.roomNumber ?? "",
    s.room?.building ?? "",
    s.room?.type ?? "",
    s.room?.capacity ?? "",
    s.timeslot?.day ?? "",
    s.timeslot?.startTime ?? "",
    s.timeslot?.endTime ?? "",
    s.semester ?? "",
    s.academicYear ?? "",
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function triggerPrint() {
  window.print();
}
