import { useState } from "react";
import {
  useListYearLevels,
  useCreateYearLevel,
  useUpdateYearLevel,
  useDeleteYearLevel,
  getListYearLevelsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, ChevronDown, ChevronRight, GraduationCap } from "lucide-react";

export default function YearLevels() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: yearLevels = [], isLoading } = useListYearLevels();

  const [expanded, setExpanded] = useState<number[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editLevel, setEditLevel] = useState<{ id: number; name: string; description: string; sectionCount: number } | null>(null);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSections, setFormSections] = useState(1);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListYearLevelsQueryKey() });

  const createMutation = useCreateYearLevel({
    mutation: {
      onSuccess: () => {
        toast({ title: "Year level created with sections" });
        setShowCreate(false);
        setFormName(""); setFormDesc(""); setFormSections(1);
        invalidate();
      },
      onError: () => toast({ title: "Failed to create year level", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateYearLevel({
    mutation: {
      onSuccess: () => {
        toast({ title: "Year level updated" });
        setEditLevel(null);
        invalidate();
      },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteYearLevel({
    mutation: {
      onSuccess: () => { toast({ title: "Year level deleted" }); invalidate(); },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    },
  });

  function toggleExpand(id: number) {
    setExpanded((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function openEdit(level: typeof yearLevels[number]) {
    setEditLevel({ id: level.id, name: level.name, description: level.description ?? "", sectionCount: level.sectionCount });
  }

  function handleCreate() {
    createMutation.mutate({ data: { name: formName, description: formDesc || undefined, sectionCount: formSections } });
  }

  function handleUpdate() {
    if (!editLevel) return;
    updateMutation.mutate({
      id: editLevel.id,
      data: { name: editLevel.name, description: editLevel.description, sectionCount: editLevel.sectionCount },
    });
  }

  const totalSections = yearLevels.reduce((sum, l) => sum + (l.sections?.length ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Year Levels & Sections</h1>
          <p className="text-muted-foreground">Manage year levels and their sections. Sections are auto-generated when a year level is created.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Year Level
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{yearLevels.length}</p>
                <p className="text-sm text-muted-foreground">Year Levels</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{totalSections}</p>
                <p className="text-sm text-muted-foreground">Total Sections</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {totalSections > 0 ? Math.round(yearLevels.reduce((sum, l) => sum + (l.sections?.reduce((s, sec) => s + sec.capacity, 0) ?? 0), 0) / (totalSections || 1)) : 0}
                </p>
                <p className="text-sm text-muted-foreground">Avg Capacity</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : yearLevels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No year levels yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {yearLevels.map((level) => {
            const isExpanded = expanded.includes(level.id);
            return (
              <Card key={level.id} className="overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(level.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="font-semibold">{level.name}</p>
                      {level.description && <p className="text-sm text-muted-foreground">{level.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{level.sections?.length ?? 0} sections</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); openEdit(level); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: level.id }); }}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {isExpanded && level.sections && level.sections.length > 0 && (
                  <div className="border-t bg-muted/20 px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">SECTIONS</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {level.sections.map((sec) => (
                        <div key={sec.id} className="bg-background rounded-md border px-3 py-2">
                          <p className="font-medium text-sm">{sec.name}</p>
                          <p className="text-xs text-muted-foreground">Capacity: {sec.capacity}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Year Level</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Year Level Name *</label>
              <Input placeholder="e.g. 1st Year, Grade 11" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input placeholder="Optional description" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Number of Sections *</label>
              <Input
                type="number"
                min={1}
                max={12}
                value={formSections}
                onChange={(e) => setFormSections(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Sections will be auto-labeled A, B, C…</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!formName.trim() || createMutation.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editLevel && (
        <Dialog open={!!editLevel} onOpenChange={() => setEditLevel(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Year Level</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name *</label>
                <Input value={editLevel.name} onChange={(e) => setEditLevel({ ...editLevel, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input value={editLevel.description} onChange={(e) => setEditLevel({ ...editLevel, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Number of Sections</label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={editLevel.sectionCount}
                  onChange={(e) => setEditLevel({ ...editLevel, sectionCount: Number(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditLevel(null)}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={!editLevel.name.trim() || updateMutation.isPending}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
