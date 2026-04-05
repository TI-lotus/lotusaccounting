import { useState } from "react";
import { X, Maximize2, Minimize2, FileText, FileCode, File, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface ViewableDocument {
  id: string;
  name: string;
  type: string;
  category: string;
  clientName?: string;
  date?: string;
  content: string;
  size?: string;
}

interface DocumentViewerProps {
  document: ViewableDocument | null;
  onClose: () => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-5 w-5 text-red-500" />,
  xml: <FileCode className="h-5 w-5 text-emerald-500" />,
  xlsx: <File className="h-5 w-5 text-green-600" />,
  docx: <FileText className="h-5 w-5 text-blue-500" />,
  csv: <File className="h-5 w-5 text-amber-500" />,
};

export const DocumentViewer = ({ document, onClose }: DocumentViewerProps) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  if (!document) return null;

  return (
    <div className={cn(
      "border-l border-border bg-card flex flex-col transition-all duration-300",
      isFullScreen ? "fixed inset-0 z-50" : "w-1/2 min-w-[400px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3 min-w-0">
          {typeIcons[document.type] || <FileText className="h-5 w-5" />}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{document.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[10px]">{document.category}</Badge>
              {document.clientName && <span className="text-xs text-muted-foreground">{document.clientName}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => {}}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setIsFullScreen(!isFullScreen)}>
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
            {document.date && <span>Data: {document.date}</span>}
            {document.size && <span>Tamanho: {document.size}</span>}
          </div>
          <div className="bg-muted/50 rounded-xl p-5 border border-border">
            <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed text-foreground/90">
              {document.content}
            </pre>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
