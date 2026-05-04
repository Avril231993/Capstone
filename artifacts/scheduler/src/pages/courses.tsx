import { useState } from "react";
import { useListCourses, useCreateCourse, useUpdateCourse, useDeleteCourse, getListCoursesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Pencil, Trash2, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const courseSchema = z.object({
  code: z.string().min(1, "Course code is required"),
  name: z.string().min(1, "Course name is required"),
  department: z.string().min(1, "Department is required"),
  units: z.coerce.number().int().min(1).max(6),
  section: z.string().min(1, "Section is required"),
  enrollmentCount: z.coerce.number().int().min(0),
  description: z.string().optional(),
});

type CourseForm = z.infer<typeof courseSchema>;

const DEPARTMENTS = ["Computer Science", "Mathematics", "Physics", "English", "Engineering", "Business", "Education"];

export default function Courses() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: courses, isLoading } = useListCourses({ search: search || undefined });
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const deleteCourse = useDeleteCourse();

  const form = useForm<CourseForm>({
    resolver: zodResolver(courseSchema),
    defaultValues: { code: "", name: "", department: "", units: 3, section: "A", enrollmentCount: 30, description: "" },
  });

  function openCreate() {
    setEditingId(null);
    form.reset({ code: "", name: "", department: "", units: 3, section: "A", enrollmentCount: 30, description: "" });
    setDialogOpen(true);
  }

  function openEdit(course: NonNullable<typeof courses>[0]) {
    setEditingId(course.id);
    form.reset({ code: course.code, name: course.name, department: course.department, units: course.units, section: course.section, enrollmentCount: course.enrollmentCount, description: course.description ?? "" });
    setDialogOpen(true);
  }

  function onSubmit(data: CourseForm) {
    if (editingId) {
      updateCourse.mutate({ id: editingId, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
          setDialogOpen(false);
          toast({ title: "Course updated" });
        },
        onError: () => toast({ title: "Error updating course", variant: "destructive" }),
      });
    } else {
      createCourse.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
          setDialogOpen(false);
          toast({ title: "Course created" });
        },
        onError: () => toast({ title: "Error creating course", variant: "destructive" }),
      });
    }
  }

  function handleDelete(id: number) {
    deleteCourse.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
        toast({ title: "Course deleted" });
      },
      onError: () => toast({ title: "Error deleting course", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
          <p className="text-muted-foreground mt-1">Manage all courses and sections</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-course">
          <Plus className="h-4 w-4 mr-2" /> Add Course
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-search-courses"
          className="pl-9"
          placeholder="Search courses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            {isLoading ? "Loading..." : `${courses?.length ?? 0} course(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !courses?.length ? (
            <div className="p-12 text-center text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No courses found</p>
              <p className="text-sm mt-1">Add your first course to get started</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Units</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Section</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Enrollment</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {courses.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-course-${c.id}`}>
                      <td className="px-4 py-3 font-mono font-medium text-primary">{c.code}</td>
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{c.department}</Badge></td>
                      <td className="px-4 py-3 text-center">{c.units}</td>
                      <td className="px-4 py-3">{c.section}</td>
                      <td className="px-4 py-3">{c.enrollmentCount}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(c)} data-testid={`button-edit-course-${c.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)} data-testid={`button-delete-course-${c.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Course" : "Add Course"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course Code</FormLabel>
                    <FormControl><Input placeholder="CS101" {...field} data-testid="input-course-code" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="section" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section</FormLabel>
                    <FormControl><Input placeholder="A" {...field} data-testid="input-course-section" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Name</FormLabel>
                  <FormControl><Input placeholder="Introduction to Computer Science" {...field} data-testid="input-course-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-course-department"><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                    <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="units" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Units</FormLabel>
                    <FormControl><Input type="number" min={1} max={6} {...field} data-testid="input-course-units" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="enrollmentCount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enrollment</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} data-testid="input-course-enrollment" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl><Input placeholder="Brief course description..." {...field} data-testid="input-course-description" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createCourse.isPending || updateCourse.isPending} data-testid="button-submit-course">
                  {editingId ? "Save Changes" : "Create Course"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
