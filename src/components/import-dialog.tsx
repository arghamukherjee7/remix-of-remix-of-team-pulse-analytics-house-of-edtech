import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseSpreadsheet, downloadTemplate } from "@/lib/import-parse";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  headers: string[];
  sample?: Record<string, any>[];
  templateFilename?: string;
  onImport: (rows: Record<string, any>[]) => Promise<{ inserted: number; skipped?: number; errors?: string[] }>;
  triggerLabel?: string;
};

export function ImportDialog({ title, headers, sample, templateFilename, onImport, triggerLabel = "Import" }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    try {
      const parsed = await parseSpreadsheet(file);
      if (!parsed.length) { toast.error("File is empty"); return; }
      setRows(parsed);
    } catch (e: any) {
      toast.error(`Parse error: ${e.message}`);
    }
  }

  async function commit() {
    setBusy(true);
    try {
      const res = await onImport(rows);
      toast.success(`Imported ${res.inserted} rows${res.skipped ? ` · skipped ${res.skipped}` : ""}`);
      if (res.errors?.length) toast.warning(`${res.errors.length} errors`, { description: res.errors.slice(0, 3).join("; ") });
      setOpen(false); setRows([]);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setRows([]); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1" />{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Expected columns: <code className="bg-muted px-1 rounded">{headers.join(", ")}</code></p>
            <Button variant="ghost" size="sm" onClick={() => downloadTemplate(templateFilename ?? "template.xlsx", headers, sample)}>
              <Download className="h-4 w-4 mr-1" />Template
            </Button>
          </div>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className={cn("flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors",
              dragOver ? "border-accent bg-accent/5" : "border-border hover:border-accent/50")}
          >
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Drop CSV/XLSX or click to browse</p>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
          {rows.length > 0 && (
            <div className="border rounded-md">
              <div className="p-2 text-xs bg-muted/50 border-b">Preview ({rows.length} rows)</div>
              <div className="max-h-64 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>{Object.keys(rows[0]).map((h) => <TableHead key={h} className="text-xs">{h}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 20).map((r, i) => (
                      <TableRow key={i}>{Object.keys(rows[0]).map((h) => <TableCell key={h} className="text-xs py-1">{String(r[h] ?? "")}</TableCell>)}</TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={commit} disabled={!rows.length || busy}>{busy ? "Importing…" : `Import ${rows.length} rows`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
