import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UploadedFile {
  id: string;
  file: File;
  type: string;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
}

export function UploadView() {
  const [clientName, setClientName] = useState('');
  const [financialYear, setFinancialYear] = useState('2024-25');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      type: 'other',
      status: 'uploading',
      progress: 0,
    }));

    setFiles(prev => [...prev, ...uploadedFiles]);

    // Simulate upload and processing
    uploadedFiles.forEach((uf) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setFiles(prev => prev.map(f => 
            f.id === uf.id 
              ? { ...f, progress: 100, status: 'processing' } 
              : f
          ));
          
          // Simulate processing
          setTimeout(() => {
            setFiles(prev => prev.map(f => 
              f.id === uf.id 
                ? { ...f, status: 'complete' } 
                : f
            ));
          }, 1500);
        } else {
          setFiles(prev => prev.map(f => 
            f.id === uf.id 
              ? { ...f, progress } 
              : f
          ));
        }
      }, 200);
    });
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFileType = (id: string, type: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, type } : f
    ));
  };

  const getFileIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      default:
        return <FileText className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload Documents</h1>
        <p className="text-muted-foreground mt-1">
          Upload client documents for AI-powered analysis
        </p>
      </div>

      {/* Client Info */}
      <div className="stat-card">
        <h3 className="text-lg font-semibold mb-4">Client Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">Client Name</Label>
            <Input
              id="clientName"
              placeholder="Enter client name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="financialYear">Financial Year</Label>
            <Select value={financialYear} onValueChange={setFinancialYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024-25">2024-25 (AY 2025-26)</SelectItem>
                <SelectItem value="2023-24">2023-24 (AY 2024-25)</SelectItem>
                <SelectItem value="2022-23">2022-23 (AY 2023-24)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200",
          isDragging 
            ? "border-accent bg-accent/5" 
            : "border-border hover:border-accent/50 hover:bg-muted/30"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
            <Upload className={cn(
              "w-8 h-8 transition-colors",
              isDragging ? "text-accent" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <p className="text-lg font-medium">Drop files here or click to upload</p>
            <p className="text-sm text-muted-foreground mt-1">
              Supports PDF, Excel, JPG, PNG (max 50MB per file)
            </p>
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
            />
            <Button variant="outline" asChild>
              <span>Browse Files</span>
            </Button>
          </label>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="stat-card">
          <h3 className="text-lg font-semibold mb-4">Uploaded Documents ({files.length})</h3>
          <div className="space-y-3">
            {files.map((file) => (
              <div 
                key={file.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border/50"
              >
                <div className="flex-shrink-0">
                  {getFileIcon(file.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{file.file.name}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(file.file.size)}
                    </span>
                  </div>
                  {file.status === 'uploading' && (
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                  {file.status === 'processing' && (
                    <p className="text-xs text-accent mt-1">Extracting data...</p>
                  )}
                  {file.status === 'complete' && (
                    <p className="text-xs text-success mt-1">Data extracted successfully</p>
                  )}
                </div>
                <Select 
                  value={file.type} 
                  onValueChange={(value) => updateFileType(file.id, value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="form16">Form 16</SelectItem>
                    <SelectItem value="bank-statement">Bank Statement</SelectItem>
                    <SelectItem value="gst-return">GST Return</SelectItem>
                    <SelectItem value="investment-proof">Investment Proof</SelectItem>
                    <SelectItem value="expense-sheet">Expense Sheet</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setFiles([])}>
              Clear All
            </Button>
            <Button>
              Start Analysis
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
