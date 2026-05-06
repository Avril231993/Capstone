import { useState } from "react";
import {
  useListYearLevels,
  useListSections,
  useUpdateSection,
  useGetOverflowSuggestions,
  getListSectionsQueryKey,
  getListYearLevelsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Users,
  GraduationCap,
  Pencil,
  TrendingUp,
  Info,
} from "lucide-react";
import type { Section, SectionTransferSuggestion, OverflowSuggestionsResponse } from "@workspace/api-client-react";

const CAPACITY_LIMIT = 40;

function capacityStatus(enrolled: number, capacity: number) {
  const pct = (enrolled / capacity) * 100;
  if (enrolled > capacity) return { label: "Over Capacity", color: "destructive" as const, bg: "bg-red-50 border-red-200", bar: "bg-red-500", pct: Math.min(pct, 100) };
  if (pct >= 90) return { label: "Near Full", color: "default" as const, bg: "bg-amber-50 border-amber-200", bar: "bg-amber-500", pct };
  if (pct >= 70) return { label: "High", color: "secondary" as const, bg: "bg-blue-50 border-blue-100", bar: "bg-blue-500", pct };
  return { label: "Available", color: "secondary" as const, bg: "bg-green-50 border-green-100", bar: "bg-green-500", pct };
}

const PRIORITY_CONFIG = {
  high: { label: "High Priority", class: "bg-red-100 text-red-800 border-red-200" },
  medium: { label: "Medium", class: "bg-amber-100 text-amber-800 border-amber-200" },
  low: { label: "Low", class: "bg-blue-100 text-blue-800 border-blue-200" },
};

export default function Enrollment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: yearLevels = [], isLoading: ylLoading } = useListYearLevels();
  const { data: sections = [], isLoading: secLoading } = useListSections();

  const [editSection, setEditSection] = useState<Section | null>(null);
  const [editEnrolled, setEditEnrolled] = useState(0);
  const [suggestions, setSuggestions] = useState<OverflowSuggestionsResponse | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const yearLevelMap = new Map(yearLevels.map(yl => [yl.id, yl.name]));

  const overflowSections = sections.filter(s => s.enrolledCount > s.capacity);
  const nearFullSections = sections.filter(s => {
    const pct = (s.enrolledCount / s.capacity) * 100;
    return pct >= 90 && s.enrolledCount <= s.capacity;
  });
  const totalStudents = sections.reduce((sum, s) => sum + s.enrolledCount, 0);
  const totalCapacity = sections.reduce((sum, s) => sum + s.capacity, 0);

  const invalidateSections = () => {
    queryClient.invalidateQueries({ queryKey: getListSectionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListYearLevelsQueryKey() });
  };

  const updateMutation = useUpdateSection({
    mutation: {
      onSuccess: () => {
        toast({ title: "Section updated" });
        setEditSection(null);
        invalidateSections();
      },
      onError: () => toast({ title: "Failed to update section", variant: "destructive" }),
    },
  });

  const suggestionsMutation = useGetOverflowSuggestions({
    mutation: {
      onSuccess: (data) => {
        setSuggestions(data as OverflowSuggestionsResponse);
        setShowSuggestions(true);
      },
      onError: () => toast({ title: "AI analysis failed", variant: "destructive" }),
    },
  });

  function openEdit(section: Section) {
    setEditSection(section);
    setEditEnrolled(section.enrolledCount);
  }

  function handleSaveEnrolled() {
    if (!editSection) return;
    updateMutation.mutate({ id: editSection.id, data: { enrolledCount: editEnrolled } });
  }

  const sectionsByYearLevel = yearLevels.map(yl => ({
    yearLevel: yl,
    sections: sections.filter(s => s.yearLevelId === yl.id),
  })).filter(g => g.sections.length > 0);

  const isLoading = ylLoading || secLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Enrollment Management</h1>
          <p className="text-muted-foreground">
            Monitor section capacity and get AI-powered transfer suggestions for overcrowded sections.
          </p>
        </div>
        <Button
          onClick={() => suggestionsMutation.mutate({})}
          disabled={suggestionsMutation.isPending || overflowSections.length === 0}
          className={overflowSections.length > 0 ? "bg-purple-600 hover:bg-purple-700" : ""}
        >
          {suggestionsMutation.isPending ? (
            <>
              <Sparkles className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              AI Transfer Suggestions
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalStudents}</p>
                <p className="text-sm text-muted-foreground">Total Enrolled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{sections.length}</p>
                <p className="text-sm text-muted-foreground">Total Sections</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={overflowSections.length > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-8 w-8 ${overflowSections.length > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              <div>
                <p className="text-2xl font-bold">{overflowSections.length}</p>
                <p className="text-sm text-muted-foreground">Over Capacity</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {totalCapacity > 0 ? Math.round((totalStudents / totalCapacity) * 100) : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Overall Fill Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {overflowSections.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-red-800 flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5" />
              {overflowSections.length} section{overflowSections.length > 1 ? "s" : ""} over the {CAPACITY_LIMIT}-student limit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {overflowSections.map(s => (
                <Badge key={s.id} variant="destructive" className="flex items-center gap-1">
                  {s.name}: {s.enrolledCount}/{s.capacity}
                  <span className="font-bold">(+{s.enrolledCount - s.capacity})</span>
                </Badge>
              ))}
            </div>
            <p className="text-sm text-red-700 mt-3">
              Click <strong>"AI Transfer Suggestions"</strong> above to get specific recommendations for moving excess students.
            </p>
          </CardContent>
        </Card>
      )}

      {sections.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-medium text-muted-foreground">No sections found.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create year levels and sections first on the Year Levels & Sections page.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {sectionsByYearLevel.map(({ yearLevel, sections: ylSections }) => (
            <div key={yearLevel.id}>
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-semibold">{yearLevel.name}</h2>
                <Badge variant="outline" className="text-xs">{ylSections.length} sections</Badge>
                {ylSections.some(s => s.enrolledCount > s.capacity) && (
                  <Badge variant="destructive" className="text-xs">Has Overflow</Badge>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ylSections.map(section => {
                  const status = capacityStatus(section.enrolledCount, section.capacity);
                  return (
                    <Card key={section.id} className={`border ${status.bg} transition-all`}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-sm">{section.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge
                                variant={status.color}
                                className="text-xs h-5"
                              >
                                {status.label}
                              </Badge>
                              {section.enrolledCount > section.capacity && (
                                <span className="text-xs font-bold text-red-600">
                                  +{section.enrolledCount - section.capacity} over
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 -mt-1 -mr-1"
                            onClick={() => openEdit(section)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{section.enrolledCount} enrolled</span>
                            <span>{section.capacity} capacity</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${status.bar}`}
                              style={{ width: `${Math.min(status.pct, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground text-right">
                            {section.capacity - section.enrolledCount > 0
                              ? `${section.capacity - section.enrolledCount} slots available`
                              : section.enrolledCount === section.capacity
                              ? "Full"
                              : `${section.enrolledCount - section.capacity} students over limit`}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editSection} onOpenChange={() => setEditSection(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Enrollment — {editSection?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Capacity limit</span>
              <span className="font-medium">{editSection?.capacity ?? CAPACITY_LIMIT} students</span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Enrolled Students</label>
              <Input
                type="number"
                min={0}
                value={editEnrolled}
                onChange={e => setEditEnrolled(Number(e.target.value))}
              />
              {editEnrolled > (editSection?.capacity ?? CAPACITY_LIMIT) && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {editEnrolled - (editSection?.capacity ?? CAPACITY_LIMIT)} students over the limit
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSection(null)}>Cancel</Button>
            <Button onClick={handleSaveEnrolled} disabled={updateMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Transfer Suggestions
            </DialogTitle>
          </DialogHeader>

          {suggestions && (
            <div className="space-y-5">
              {suggestions.summary && (
                <div className="flex gap-3 p-4 rounded-lg bg-purple-50 border border-purple-100">
                  <Info className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-purple-900">{suggestions.summary}</p>
                </div>
              )}

              {suggestions.overflowSections.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Overflow Sections</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.overflowSections.map(s => (
                      <div key={s.id} className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-1.5 text-sm">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="font-medium">{s.name}</span>
                        <span className="text-red-600">{s.enrolledCount}/{s.capacity}</span>
                        <Badge variant="destructive" className="text-xs">
                          +{s.enrolledCount - s.capacity} over
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {suggestions.suggestions.length > 0 ? (
                <div>
                  <p className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                    Transfer Recommendations ({suggestions.suggestions.length})
                  </p>
                  <div className="space-y-3">
                    {suggestions.suggestions.map((s: SectionTransferSuggestion, i: number) => {
                      const priorityCfg = PRIORITY_CONFIG[s.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
                      return (
                        <div key={i} className="border rounded-lg p-4 bg-background">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {s.yearLevel}
                              </Badge>
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${priorityCfg.class}`}>
                                {priorityCfg.label}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 my-3">
                            <div className="text-center flex-1">
                              <p className="text-sm font-semibold">{s.fromSectionName}</p>
                              <p className="text-xs text-muted-foreground">From section</p>
                            </div>
                            <div className="flex flex-col items-center text-primary">
                              <ArrowRight className="h-5 w-5" />
                              <span className="text-xs font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full mt-1">
                                {s.studentsToTransfer} students
                              </span>
                            </div>
                            <div className="text-center flex-1">
                              <p className="text-sm font-semibold">{s.toSectionName}</p>
                              <p className="text-xs text-muted-foreground">To section</p>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground italic border-t pt-2 mt-2">{s.reason}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="text-sm text-green-800">No transfer suggestions needed — all sections are within capacity.</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-right">
                Generated {suggestions.generatedAt ? new Date(suggestions.generatedAt).toLocaleString() : ""}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuggestions(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
