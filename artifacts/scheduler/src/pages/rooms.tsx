import { useState } from "react";
import { useListRooms, useCreateRoom, useUpdateRoom, useDeleteRoom, useGetRoomUtilization, getListRoomsQueryKey } from "@workspace/api-client-react";
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
import { Plus, Pencil, Trash2, DoorOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROOM_TYPES = [
  { value: "lecture", label: "Lecture Hall" },
  { value: "lab", label: "Laboratory" },
  { value: "computer", label: "Computer Lab" },
  { value: "seminar", label: "Seminar Room" },
  { value: "gym", label: "Gymnasium" },
];

const roomSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  building: z.string().min(1, "Building is required"),
  capacity: z.coerce.number().int().min(1),
  type: z.enum(["lecture", "lab", "computer", "seminar", "gym"]),
  features: z.string().optional(),
});
type RoomForm = z.infer<typeof roomSchema>;

const typeColors: Record<string, string> = {
  lecture: "bg-blue-500/10 text-blue-700 border-blue-200",
  lab: "bg-green-500/10 text-green-700 border-green-200",
  computer: "bg-purple-500/10 text-purple-700 border-purple-200",
  seminar: "bg-orange-500/10 text-orange-700 border-orange-200",
  gym: "bg-red-500/10 text-red-700 border-red-200",
};

export default function Rooms() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rooms, isLoading } = useListRooms();
  const { data: utilization } = useGetRoomUtilization({ semester: "1st Semester", academicYear: "2025-2026" });
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();

  const utilMap = new Map(utilization?.map(u => [u.roomId, u]) ?? []);

  const form = useForm<RoomForm>({
    resolver: zodResolver(roomSchema),
    defaultValues: { roomNumber: "", building: "", capacity: 40, type: "lecture", features: "" },
  });

  function openCreate() {
    setEditingId(null);
    form.reset({ roomNumber: "", building: "", capacity: 40, type: "lecture", features: "" });
    setDialogOpen(true);
  }

  function openEdit(r: NonNullable<typeof rooms>[0]) {
    setEditingId(r.id);
    form.reset({ roomNumber: r.roomNumber, building: r.building, capacity: r.capacity, type: r.type as RoomForm["type"], features: r.features ?? "" });
    setDialogOpen(true);
  }

  function onSubmit(data: RoomForm) {
    if (editingId) {
      updateRoom.mutate({ id: editingId, data }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() }); setDialogOpen(false); toast({ title: "Room updated" }); },
        onError: () => toast({ title: "Error updating room", variant: "destructive" }),
      });
    } else {
      createRoom.mutate({ data }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() }); setDialogOpen(false); toast({ title: "Room created" }); },
        onError: () => toast({ title: "Error creating room", variant: "destructive" }),
      });
    }
  }

  function handleDelete(id: number) {
    deleteRoom.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() }); toast({ title: "Room deleted" }); },
      onError: () => toast({ title: "Error deleting room", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rooms</h1>
          <p className="text-muted-foreground mt-1">Manage classroom inventory and monitor utilization</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-room"><Plus className="h-4 w-4 mr-2" />Add Room</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ROOM_TYPES.map(t => {
          const count = rooms?.filter(r => r.type === t.value).length ?? 0;
          return (
            <Card key={t.value} className="text-center p-4">
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.label}</div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DoorOpen className="h-4 w-4" />
            {isLoading ? "Loading..." : `${rooms?.length ?? 0} room(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : !rooms?.length ? (
            <div className="p-12 text-center text-muted-foreground">
              <DoorOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No rooms found</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Room</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Building</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Capacity</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Utilization</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Features</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rooms.map((r) => {
                    const util = utilMap.get(r.id);
                    return (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-room-${r.id}`}>
                        <td className="px-4 py-3 font-mono font-medium text-primary">{r.roomNumber}</td>
                        <td className="px-4 py-3">{r.building}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${typeColors[r.type] ?? ""}`}>
                            {ROOM_TYPES.find(t => t.value === r.type)?.label ?? r.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">{r.capacity}</td>
                        <td className="px-4 py-3 min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <Progress value={util?.utilizationRate ?? 0} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{util?.utilizationRate ?? 0}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{r.features ?? "—"}</td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)} data-testid={`button-edit-room-${r.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(r.id)} data-testid={`button-delete-room-${r.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Edit Room" : "Add Room"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="roomNumber" render={({ field }) => (
                  <FormItem><FormLabel>Room Number</FormLabel><FormControl><Input placeholder="101" {...field} data-testid="input-room-number" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="building" render={({ field }) => (
                  <FormItem><FormLabel>Building</FormLabel><FormControl><Input placeholder="Main Building" {...field} data-testid="input-room-building" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-room-type"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent>{ROOM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="capacity" render={({ field }) => (
                  <FormItem><FormLabel>Capacity</FormLabel><FormControl><Input type="number" min={1} {...field} data-testid="input-room-capacity" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="features" render={({ field }) => (
                <FormItem><FormLabel>Features (optional)</FormLabel><FormControl><Input placeholder="Projector, whiteboard, AC..." {...field} data-testid="input-room-features" /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createRoom.isPending || updateRoom.isPending} data-testid="button-submit-room">{editingId ? "Save Changes" : "Add Room"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
