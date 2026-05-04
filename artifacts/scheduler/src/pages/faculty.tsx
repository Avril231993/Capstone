import { useState } from "react";
import { useListFaculty, useCreateFaculty, useUpdateFaculty, useDeleteFaculty, useGetFacultyLoads, getListFacultyQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Pencil, Trash2, Users, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RANKS = [
  { value: "instructor", label: "Instructor" },
  { value: "assistant_professor", label: "Assistant Professor" },
  { value: "associate_professor", label: "Associate Professor" },
  { value: "professor", label: "Professor" },
  { value: "part_time", label: "Part-time" },
];

const DEPARTMENTS = ["Computer Science", "Mathematics", "Physics", "English", "Engineering", "Business", "Education"];

const facultySchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  department: z.string().min(1, "Department is required"),
  specialization: z.string().optional(),
  rank: z.enum(["instructor", "assistant_professor", "associate_professor", "professor", "part_time"]),
  maxUnits: z.coerce.number().int().min(1).max(30),
});
type FacultyForm = z.infer<typeof facultySchema>;

function getStatusBadge(status: string) {
  if (status === "overloaded") return <Badge variant="destructive" className="text-xs">Overloaded</Badge>;
  if (status === "underloaded") return <Badge variant="secondary" className="text-xs">Underloaded</Badge>;
  return <Badge className="text-xs bg-green-500/10 text-green-700 border-green-200">Normal</Badge>;
}

export default function Faculty() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: faculty, isLoading } = useListFaculty({ search: search || undefined });
  const { data: loads } = useGetFacultyLoads({ semester: "1st Semester", academicYear: "2025-2026" });
  const createFaculty = useCreateFaculty();
  const updateFaculty = useUpdateFaculty();
  const deleteFaculty = useDeleteFaculty();

  const loadMap = new Map(loads?.map(l => [l.facultyId, l]) ?? []);

  const form = useForm<FacultyForm>({
    resolver: zodResolver(facultySchema),
    defaultValues: { name: "", email: "", department: "", specialization: "", rank: "instructor", maxUnits: 21 },
  });

  function openCreate() {
    setEditingId(null);
    form.reset({ name: "", email: "", department: "", specialization: "", rank: "instructor", maxUnits: 21 });
    setDialogOpen(true);
  }

  function openEdit(f: NonNullable<typeof faculty>[0]) {
    setEditingId(f.id);
    form.reset({ name: f.name, email: f.email, department: f.department, specialization: f.specialization ?? "", rank: f.rank as FacultyForm["rank"], maxUnits: f.maxUnits });
    setDialogOpen(true);
  }

  function onSubmit(data: FacultyForm) {
    if (editingId) {
      updateFaculty.mutate({ id: editingId, data }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFacultyQueryKey() }); setDialogOpen(false); toast({ title: "Faculty updated" }); },
        onError: () => toast({ title: "Error updating faculty", variant: "destructive" }),
      });
    } else {
      createFaculty.mutate({ data }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFacultyQueryKey() }); setDialogOpen(false); toast({ title: "Faculty created" }); },
        onError: () => toast({ title: "Error creating faculty", variant: "destructive" }),
      });
    }
  }

  function handleDelete(id: number) {
    deleteFaculty.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFacultyQueryKey() }); toast({ title: "Faculty deleted" }); },
      onError: () => toast({ title: "Error deleting faculty", variant: "destructive" }),
    });
  }

  const rankLabel = (r: string) => RANKS.find(x => x.value === r)?.label ?? r;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Faculty</h1>
          <p className="text-muted-foreground mt-1">Manage faculty members and monitor teaching loads</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-faculty"><Plus className="h-4 w-4 mr-2" />Add Faculty</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search faculty..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-faculty" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            {isLoading ? "Loading..." : `${faculty?.length ?? 0} faculty member(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : !faculty?.length ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No faculty members found</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rank</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Load</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {faculty.map((f) => {
                    const load = loadMap.get(f.id);
                    const pct = load ? Math.min(100, load.loadPercentage) : 0;
                    return (
                      <tr key={f.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-faculty-${f.id}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{f.name}</div>
                          <div className="text-xs text-muted-foreground">{f.email}</div>
                        </td>
                        <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{f.department}</Badge></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{rankLabel(f.rank)}</td>
                        <td className="px-4 py-3 min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{load?.assignedUnits ?? 0}/{f.maxUnits}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{load ? getStatusBadge(load.status) : <Badge variant="secondary" className="text-xs">N/A</Badge>}</td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(f)} data-testid={`button-edit-faculty-${f.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(f.id)} data-testid={`button-delete-faculty-${f.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Edit Faculty" : "Add Faculty"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Dr. Jane Smith" {...field} data-testid="input-faculty-name" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="jane.smith@university.edu" {...field} data-testid="input-faculty-email" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem><FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-faculty-department"><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                      <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="rank" render={({ field }) => (
                  <FormItem><FormLabel>Rank</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-faculty-rank"><SelectValue placeholder="Select rank" /></SelectTrigger></FormControl>
                      <SelectContent>{RANKS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="specialization" render={({ field }) => (
                  <FormItem><FormLabel>Specialization</FormLabel><FormControl><Input placeholder="e.g. Machine Learning" {...field} data-testid="input-faculty-specialization" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="maxUnits" render={({ field }) => (
                  <FormItem><FormLabel>Max Units</FormLabel><FormControl><Input type="number" min={1} max={30} {...field} data-testid="input-faculty-max-units" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createFaculty.isPending || updateFaculty.isPending} data-testid="button-submit-faculty">{editingId ? "Save Changes" : "Add Faculty"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
