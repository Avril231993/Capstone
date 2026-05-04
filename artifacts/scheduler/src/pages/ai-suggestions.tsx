import { useState } from "react";
import { useGetAiSuggestions, useGenerateSchedule, useListCourses, useListSchedules, getListSchedulesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, Zap, ArrowRight, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester", "Summer"];
const YEAR_OPTIONS = ["2025-2026", "2024-2025", "2026-2027"];

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-700 border-red-200",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  low: "bg-blue-500/10 text-blue-700 border-blue-200",
};

const TYPE_LABELS: Record<string, string> = {
  reassign_room: "Reassign Room",
  reassign_faculty: "Reassign Faculty",
  move_timeslot: "Move Time Slot",
  split_section: "Split Section",
  merge_section: "Merge Section",
};

export default function AiSuggestions() {
  const [semester, setSemester] = useState("1st Semester");
  const [academicYear, setAcademicYear] = useState("2025-2026");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [summary, setSummary] = useState("");
  const [generateResult, setGenerateResult] = useState<{ generatedCount: number; summary: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getAiSuggestions = useGetAiSuggestions();
  const generateSchedule = useGenerateSchedule();
  const { data: courses } = useListCourses();
  const { data: currentSchedules } = useListSchedules({ semester, academicYear });

  function handleAnalyze() {
    getAiSuggestions.mutate(
      { data: { semester, academicYear } },
      {
        onSuccess: (res) => {
          setSuggestions(res.suggestions ?? []);
          setSummary(res.summary ?? "");
        },
        onError: () => toast({ title: "Analysis failed", variant: "destructive" }),
      }
    );
  }

  function handleGenerate() {
    const scheduledIds = new Set(currentSchedules?.map(s => s.courseId) ?? []);
    const unscheduledCourseIds = courses?.filter(c => !scheduledIds.has(c.id)).map(c => c.id) ?? [];

    if (!unscheduledCourseIds.length) {
      toast({ title: "All courses are already scheduled", description: "No unscheduled courses to generate." });
      return;
    }

    generateSchedule.mutate(
      { data: { semester, academicYear, courseIds: unscheduledCourseIds, strategy: "balanced" } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          setGenerateResult({ generatedCount: res.generatedCount, summary: res.summary });
          toast({ title: `Generated ${res.generatedCount} schedule entries` });
        },
        onError: () => toast({ title: "Generation failed", variant: "destructive" }),
      }
    );
  }

  const scheduledCount = currentSchedules?.length ?? 0;
  const unscheduledCount = (courses?.length ?? 0) - new Set(currentSchedules?.map(s => s.courseId)).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Suggestions</h1>
          <p className="text-muted-foreground mt-1">AI-powered scheduling analysis and auto-generation</p>
        </div>
        <div className="flex gap-3">
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-40" data-testid="select-ai-semester"><SelectValue /></SelectTrigger>
            <SelectContent>{SEMESTER_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={academicYear} onValueChange={setAcademicYear}>
            <SelectTrigger className="w-36" data-testid="select-ai-year"><SelectValue /></SelectTrigger>
            <SelectContent>{YEAR_OPTIONS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Smart Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Analyze the current schedule for inefficiencies, overloads, and room mismatches. Get prioritized suggestions to optimize your timetable.</p>
            <Button onClick={handleAnalyze} disabled={getAiSuggestions.isPending} className="w-full" data-testid="button-analyze">
              {getAiSuggestions.isPending ? "Analyzing..." : (
                <><Lightbulb className="h-4 w-4 mr-2" />Analyze Schedule</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Auto-Generate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Automatically assign {unscheduledCount > 0 ? unscheduledCount : "all"} unscheduled course(s) to available rooms, faculty, and time slots using the balanced strategy.
            </p>
            <Button onClick={handleGenerate} disabled={generateSchedule.isPending || unscheduledCount === 0} variant="outline" className="w-full" data-testid="button-generate">
              {generateSchedule.isPending ? "Generating..." : (
                <><Zap className="h-4 w-4 mr-2" />Generate Schedule ({unscheduledCount} courses)</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {generateResult && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-800">Schedule generated successfully</p>
              <p className="text-sm text-green-700 mt-1">{generateResult.summary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {summary && (
        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground border">
          <span className="font-medium text-foreground">Analysis result: </span>{summary}
        </div>
      )}

      {getAiSuggestions.isPending ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : suggestions.length > 0 ? (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Suggestions ({suggestions.length})</h2>
          {suggestions.map((s) => (
            <Card key={s.id} data-testid={`card-suggestion-${s.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {s.priority === "high"
                      ? <AlertTriangle className="h-5 w-5 text-red-500" />
                      : <Lightbulb className="h-5 w-5 text-primary" />
                    }
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="font-medium text-sm">{s.title}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[s.priority] ?? ""}`}>
                        {s.priority} priority
                      </span>
                      <Badge variant="secondary" className="text-xs">{TYPE_LABELS[s.type] ?? s.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                    {s.proposedChanges && (
                      <div className="mt-2 flex items-start gap-1.5 text-xs text-primary">
                        <ArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <span>{s.proposedChanges}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !getAiSuggestions.isPending && getAiSuggestions.isSuccess && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-500" />
            <p className="font-medium">No issues found</p>
            <p className="text-sm mt-1">The schedule looks well-optimized.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
