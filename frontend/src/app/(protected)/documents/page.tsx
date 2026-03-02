'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Upload, FileText, CheckCircle2, AlertCircle, Clock, Trash2,
  Eye, Hash, Calendar, DollarSign, Building, FileType
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { uploadDocument, getDocuments, deleteDocument } from '@/lib/api';
import type { DocumentMetadata, DocumentType } from '@/lib/types';
import { toast } from 'sonner';

export default function DocumentsPage() {
  const { language } = useAppStore();
  const [docs, setDocs] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentMetadata | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>('bank_statement');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const d = await getDocuments();
      setDocs(d);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.error(language === 'hi' ? 'फ़ाइल 10MB से छोटी होनी चाहिए' : 'File must be under 10MB');
        return;
      }
      setUploadFile(file);
    }
  }, [language]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const result = await uploadDocument(uploadFile, docType, periodStart, periodEnd);
      toast.success(t('uploadSuccess', language));
      setUploadFile(null);
      setPeriodStart('');
      setPeriodEnd('');
      await loadDocuments();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await deleteDocument(docId);
      toast.success(language === 'hi' ? 'दस्तावेज़ हटाया गया' : 'Document deleted');
      setDocs(docs.filter(d => d.documentId !== docId));
      setSelectedDoc(null);
    } catch {
      toast.error('Failed to delete');
    }
  };

  const filteredDocs = activeTab === 'all' ? docs
    : docs.filter(d => d.verificationStatus === activeTab);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />{t('verified', language)}</Badge>;
      case 'pending_review':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />{t('pendingReviewStatus', language)}</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{t('unverified', language)}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('documents', language)}</h1>

      {/* Upload Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            {t('uploadDocument', language)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
              ${uploadFile ? 'border-green-400 bg-green-50' : ''}`}
          >
            <input {...getInputProps()} />
            {uploadFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-green-500" />
                <div className="text-left">
                  <p className="font-medium text-sm">{uploadFile.name}</p>
                  <p className="text-xs text-gray-500">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}>
                  ✕
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-600">{t('dragDrop', language)}</p>
                <p className="text-xs text-gray-400 mt-1">{t('supportedFormats', language)}</p>
              </>
            )}
          </div>

          {/* Upload Form */}
          {uploadFile && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">{t('docType', language)}</Label>
                <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_statement">{t('bankStatement', language)}</SelectItem>
                    <SelectItem value="invoice">{t('invoice', language)}</SelectItem>
                    <SelectItem value="receipt">{t('receipt', language)}</SelectItem>
                    <SelectItem value="aadhaar">{t('aadhaar', language)}</SelectItem>
                    <SelectItem value="pan">{t('pan', language)}</SelectItem>
                    <SelectItem value="other">{t('other', language)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('periodStart', language)}</Label>
                <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('periodEnd', language)}</Label>
                <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full bg-gradient-to-r from-orange-500 to-green-600 text-white"
                >
                  {uploading ? t('uploading', language) : t('upload', language)}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('myDocuments', language)}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">{language === 'hi' ? 'सभी' : 'All'} ({docs.length})</TabsTrigger>
              <TabsTrigger value="verified">{t('verified', language)} ({docs.filter(d => d.verificationStatus === 'verified').length})</TabsTrigger>
              <TabsTrigger value="pending_review">{t('pendingReviewStatus', language)} ({docs.filter(d => d.verificationStatus === 'pending_review').length})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : filteredDocs.length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-sm">{t('noDocuments', language)}</p>
              ) : (
                <div className="space-y-3">
                  {filteredDocs.map((doc) => (
                    <div
                      key={doc.documentId}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => setSelectedDoc(doc)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <FileType className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{doc.fileName}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(doc.uploadTimestamp).toLocaleDateString()}
                            </span>
                            {doc.extractedData.amount && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                ₹{doc.extractedData.amount.toLocaleString()}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              OCR: {doc.ocrConfidence}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(doc.verificationStatus)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Document Detail Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedDoc?.fileName}
            </DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-400">{t('status', language)}</p>
                  <div className="mt-1">{getStatusBadge(selectedDoc.verificationStatus)}</div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-400">{t('ocrConfidence', language)}</p>
                  <p className="font-medium text-sm mt-1">{selectedDoc.ocrConfidence}%</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-400 mb-2">{t('blockchainHash', language)}</p>
                <code className="text-xs break-all bg-white p-2 rounded border block">{selectedDoc.hash}</code>
                <p className="text-xs text-gray-400 mt-1">TX: {selectedDoc.blockchainTxId}</p>
              </div>

              <div className="p-3 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-400 mb-2">{t('extractedData', language)}</p>
                <div className="grid grid-cols-2 gap-2">
                  {selectedDoc.extractedData.date && (
                    <div>
                      <p className="text-xs text-gray-400">{t('date', language)}</p>
                      <p className="text-sm">{selectedDoc.extractedData.date}</p>
                    </div>
                  )}
                  {selectedDoc.extractedData.amount && (
                    <div>
                      <p className="text-xs text-gray-400">{t('amount', language)}</p>
                      <p className="text-sm font-medium">₹{selectedDoc.extractedData.amount.toLocaleString()}</p>
                    </div>
                  )}
                  {selectedDoc.extractedData.vendor && (
                    <div>
                      <p className="text-xs text-gray-400">{t('vendor', language)}</p>
                      <p className="text-sm">{selectedDoc.extractedData.vendor}</p>
                    </div>
                  )}
                  {selectedDoc.extractedData.description && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400">{t('description', language)}</p>
                      <p className="text-sm">{selectedDoc.extractedData.description}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(selectedDoc.documentId)}
                  className="gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('delete', language)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
