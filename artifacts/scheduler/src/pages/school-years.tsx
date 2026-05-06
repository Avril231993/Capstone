import { useState } from "react";
import {
  useListSchoolYears,
  useCreateSchoolYear,
  useArchiveSchoolYear,
  useDeleteSchoolYear,
  getListSchoolYearsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Archive, Trash2, CalendarRange, CheckCircle } from "lucide-react";

export default function SchoolYears() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schoolYears = [], isLoading } = useListSchoolYears();

  const [showCreate, setShowCreate] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newYearName, setNewYearName] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListSchoolYearsQueryKey() });

  const createMutation = useCreateSchoolYear({
    mutation: {
      onSuccess: () => {
        toast({ title: "School year created" });
        setShowCreate(false);
        setNewName(""); setNewStartDate(""); setNewEndDate("");
        invalidate();
      },
      onError: () => toast({ title: "Failed to create school year", variant: "destructive" }),
    },
  });

  const archiveMutation = useArchiveSchoolYear({
    mutation: {
      onSuccess: () => {
        toast({ title: "School year archived and new year initialized" });
        setShowArchive(false);
        setArchiveTargetId(null);
        setNewYearName("");
        invalidate();
      },
      onError: () => toast({ title: "Failed to archive", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteSchoolYear({
    mutation: {
      onSuccess: () => {
        toast({ title: "School year deleted" });
        invalidate();
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    },
  });

  const activeYear = schoolYears.find((y) => y.status === "active");
  const archivedYears = schoolYears.filter((y) => y.status === "archived");

  function handleArchiveClick(id: number) {
    setArchiveTargetId(id);
    setShowArchive(true);
  }

  function handleArchiveConfirm() {
    if (!archiveTargetId || !newYearName.trim()) return;
    archiveMutation.mutate({ data: { schoolYearId: archiveTargetId, newSchoolYearName: newYearName.trim() } });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">School Year Management</h1>
          <p className="text-muted-foreground">Manage academic year lifecycle — create, activate, and archive school years.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New School Year
        </Button>
      </div>

      {activeYear && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <CardTitle className="text-green-800">Active School Year</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-semibold text-green-900">{activeYear.name}</p>
                {activeYear.startDate && (
                  <p className="text-sm text-green-700">{activeYear.startDate} — {activeYear.endDate ?? "present"}</p>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => handleArchiveClick(activeYear.id)}
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive & Start New Year
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <CalendarRange className="h-5 w-5" />
          Archived Years ({archivedYears.length})
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : archivedYears.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No archived years yet.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {archivedYears.map((year) => (
              <Card key={year.id}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{year.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">Archived</Badge>
                      {year.archivedAt && (
                        <span className="text-xs text-muted-foreground">
                          Archived {new Date(year.archivedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate({ id: year.id })}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New School Year</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name *</label>
              <Input placeholder="e.g. 2026-2027" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({ data: { name: newName, startDate: newStartDate || undefined, endDate: newEndDate || undefined } })}
              disabled={!newName.trim() || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showArchive} onOpenChange={setShowArchive}>
        <DialogContent>
          <DialogHeader><DialogTitle>Archive School Year</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Archiving <strong>{schoolYears.find((y) => y.id === archiveTargetId)?.name}</strong> will mark it as closed.
              Enter the name of the next school year to initialize:
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">New School Year Name *</label>
              <Input
                placeholder="e.g. 2026-2027"
                value={newYearName}
                onChange={(e) => setNewYearName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchive(false)}>Cancel</Button>
            <Button
              onClick={handleArchiveConfirm}
              disabled={!newYearName.trim() || archiveMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive & Create New
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
