import { useState } from "react";
import {
  useListLoiDocuments,
  useProcessLoi,
  useDeleteLoiDocument,
  useApplyLoiExtraction,
  getListLoiDocumentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FileText, Sparkles, CheckCircle, AlertCircle, Clock, Trash2, Eye, Send } from "lucide-react";
import type { LoiDocument } from "@workspace/api-client-react";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "secondary", Icon: Clock },
  processing: { label: "Processing", color: "secondary", Icon: Clock },
  processed: { label: "Processed", color: "default", Icon: CheckCircle },
  failed: { label: "Failed", color: "destructive", Icon: AlertCircle },
} as const;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  return (
    <Badge variant={cfg.color as "default" | "secondary" | "destructive"} className="flex items-center gap-1 w-fit">
      <cfg.Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

function ExtractionViewer({ data }: { data: Record<string, unknown> }) {
  const profile = data["teacher_profile"] as Record<string, unknown> | undefined;
  const availability = data["availability"] as Record<string, string[]> | undefined;
  const notes = data["notes"] as string | undefined;

  return (
    <div className="space-y-4 text-sm">
      {profile && (
        <div>
          <p className="font-semibold text-xs text-muted-foreground uppercase mb-2">Teacher Profile</p>
          <div className="bg-muted rounded-md p-3 space-y-1">
            {Object.entries(profile).map(([k, v]) => {
              if (!v || (Array.isArray(v) && v.length === 0)) return null;
              return (
                <div key={k} className="flex gap-2">
                  <span className="text-muted-foreground capitalize min-w-32">{k.replace(/_/g, " ")}:</span>
                  <span className="font-medium">{Array.isArray(v) ? v.join(", ") : String(v)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {availability && Object.keys(availability).length > 0 && (
        <div>
          <p className="font-semibold text-xs text-muted-foreground uppercase mb-2">Availability</p>
          <div className="bg-muted rounded-md p-3 space-y-1">
            {Object.entries(availability).map(([day, times]) => (
              <div key={day} className="flex gap-2">
                <span className="text-muted-foreground min-w-24">{day}:</span>
                <div className="flex gap-1 flex-wrap">
                  {(times as string[]).map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {notes && (
        <div>
          <p className="font-semibold text-xs text-muted-foreground uppercase mb-2">Notes</p>
          <p className="text-muted-foreground italic">{notes}</p>
        </div>
      )}
    </div>
  );
}

export default function LoiPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: docs = [], isLoading } = useListLoiDocuments();

  const [loiText, setLoiText] = useState("");
  const [fileName, setFileName] = useState("");
  const [facultyIdStr, setFacultyIdStr] = useState("");
  const [viewDoc, setViewDoc] = useState<LoiDocument | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListLoiDocumentsQueryKey() });

  const processMutation = useProcessLoi({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "LOI processed successfully", description: "Review the extracted data below." });
        setLoiText("");
        setFileName("");
        setFacultyIdStr("");
        invalidate();
        if (data) setViewDoc(docs.find((d) => d.id === data.loiId) ?? null);
      },
      onError: () => toast({ title: "AI extraction failed", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteLoiDocument({
    mutation: {
      onSuccess: () => { toast({ title: "Document deleted" }); invalidate(); },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    },
  });

  const applyMutation = useApplyLoiExtraction({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Applied to faculty profile", description: (data as { message?: string })?.message });
        setViewDoc(null);
        invalidate();
      },
      onError: () => toast({ title: "Failed to apply", variant: "destructive" }),
    },
  });

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setLoiText(ev.target?.result as string ?? "");
    reader.readAsText(file);
  }

  function handleProcess() {
    if (!loiText.trim()) return;
    const facultyId = facultyIdStr ? Number(facultyIdStr) : undefined;
    processMutation.mutate({ data: { text: loiText, fileName: fileName || undefined, facultyId } });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Letter of Intent (LOI) Processing</h1>
        <p className="text-muted-foreground">Upload or paste faculty LOI text. AI will extract availability and specializations automatically.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI LOI Extraction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Upload LOI File (txt)</label>
              <Input type="file" accept=".txt,.doc,.docx" onChange={handleFileUpload} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Faculty ID (optional)</label>
              <Input
                type="number"
                placeholder="Link to existing faculty member"
                value={facultyIdStr}
                onChange={(e) => setFacultyIdStr(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">LOI Text *</label>
            <Textarea
              placeholder="Paste the full LOI text here, or upload a file above..."
              value={loiText}
              onChange={(e) => setLoiText(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          <Button
            onClick={handleProcess}
            disabled={!loiText.trim() || processMutation.isPending}
            className="w-full"
          >
            {processMutation.isPending ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Processing with AI...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Extract with AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-3">Processed Documents ({docs.length})</h2>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : docs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No LOI documents yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{doc.fileName ?? `LOI #${doc.id}`}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={doc.status} />
                          {doc.facultyId && (
                            <span className="text-xs text-muted-foreground">Faculty ID: {doc.facultyId}</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {doc.processingError && (
                          <p className="text-xs text-destructive mt-1">{doc.processingError}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {doc.status === "processed" && (
                      <Button variant="outline" size="sm" onClick={() => setViewDoc(doc)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate({ id: doc.id })}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {viewDoc && (
        <Dialog open={!!viewDoc} onOpenChange={() => setViewDoc(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Extracted Data — {viewDoc.fileName ?? `LOI #${viewDoc.id}`}
              </DialogTitle>
            </DialogHeader>
            {viewDoc.extractedData ? (
              <ExtractionViewer data={viewDoc.extractedData as Record<string, unknown>} />
            ) : (
              <p className="text-muted-foreground">No extracted data available.</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDoc(null)}>Close</Button>
              {viewDoc.facultyId && (
                <Button
                  onClick={() => applyMutation.mutate({ id: viewDoc.id })}
                  disabled={applyMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Apply to Faculty Profile
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
