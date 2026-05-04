import { useState } from "react";
import { useGetConflicts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, AlertCircle, Lightbulb } from "lucide-react";

const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester", "Summer"];
const YEAR_OPTIONS = ["2025-2026", "2024-2025", "2026-2027"];

const CONFLICT_TYPE_LABELS: Record<string, string> = {
  room_conflict: "Room Double-booking",
  faculty_conflict: "Faculty Conflict",
  overload: "Faculty Overload",
};

const CONFLICT_TYPE_COLORS: Record<string, string> = {
  room_conflict: "bg-red-500/10 text-red-700 border-red-200",
  faculty_conflict: "bg-orange-500/10 text-orange-700 border-orange-200",
  overload: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
};

export default function Conflicts() {
  const [semester, setSemester] = useState("1st Semester");
  const [academicYear, setAcademicYear] = useState("2025-2026");

  const { data: conflicts, isLoading } = useGetConflicts({ semester, academicYear });

  const errors = conflicts?.filter(c => c.severity === "error") ?? [];
  const warnings = conflicts?.filter(c => c.severity === "warning") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conflicts</h1>
          <p className="text-muted-foreground mt-1">Detected scheduling conflicts and resolution hints</p>
        </div>
        <div className="flex gap-3">
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-40" data-testid="select-conflicts-semester"><SelectValue /></SelectTrigger>
            <SelectContent>{SEMESTER_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={academicYear} onValueChange={setAcademicYear}>
            <SelectTrigger className="w-36" data-testid="select-conflicts-year"><SelectValue /></SelectTrigger>
            <SelectContent>{YEAR_OPTIONS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center p-4">
          <div className="text-3xl font-bold text-foreground">{conflicts?.length ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">Total Issues</div>
        </Card>
        <Card className="text-center p-4">
          <div className="text-3xl font-bold text-destructive">{errors.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Errors</div>
        </Card>
        <Card className="text-center p-4">
          <div className="text-3xl font-bold text-yellow-600">{warnings.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Warnings</div>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : !conflicts?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-semibold">No conflicts detected</p>
            <p className="text-sm text-muted-foreground mt-2">The current schedule for {semester} {academicYear} is clean.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conflicts.map((c) => (
            <Card key={c.id} className={`border-l-4 ${c.severity === "error" ? "border-l-destructive" : "border-l-yellow-500"}`} data-testid={`card-conflict-${c.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5">
                      {c.severity === "error"
                        ? <AlertTriangle className="h-5 w-5 text-destructive" />
                        : <AlertCircle className="h-5 w-5 text-yellow-500" />
                      }
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CONFLICT_TYPE_COLORS[c.type] ?? ""}`}>
                          {CONFLICT_TYPE_LABELS[c.type] ?? c.type}
                        </span>
                        <Badge variant={c.severity === "error" ? "destructive" : "secondary"} className="text-xs capitalize">{c.severity}</Badge>
                      </div>
                      <p className="text-sm font-medium">{c.description}</p>
                      {c.affectedScheduleIds.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Affected schedule IDs: {c.affectedScheduleIds.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  {c.suggestedFix && (
                    <div className="bg-muted/50 rounded-lg p-3 max-w-xs flex-shrink-0">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                        <Lightbulb className="h-3.5 w-3.5" /> Suggested Fix
                      </div>
                      <p className="text-xs text-foreground">{c.suggestedFix}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
