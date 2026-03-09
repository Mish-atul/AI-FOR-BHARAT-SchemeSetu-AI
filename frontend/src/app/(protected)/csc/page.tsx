'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2, Users, FileText, CheckCircle2, XCircle, Clock,
  Eye, Loader2, AlertTriangle, Shield
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { getVerificationQueue, submitVerification } from '@/lib/api';
import type { VerificationQueueItem } from '@/lib/types';
import { toast } from 'sonner';

export default function CSCPage() {
  const { language } = useAppStore();
  const [queue, setQueue] = useState<VerificationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<VerificationQueueItem | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    getVerificationQueue()
      .then(setQueue)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pendingItems = queue.filter(q => q.status === 'pending');
  const completedItems = queue.filter(q => q.status !== 'pending');

  const handleReview = (item: VerificationQueueItem) => {
    setSelectedItem(item);
    setDecision('approved');
    setNotes('');
    setShowReview(true);
  };

  const handleSubmit = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      await submitVerification(selectedItem.documentId, { notes }, decision === 'approved');
      setQueue(prev =>
        prev.map(q =>
          q.documentId === selectedItem.documentId
            ? { ...q, status: decision, verifiedAt: new Date().toISOString(), verifierNotes: notes }
            : q
        )
      );
      setShowReview(false);
      toast.success(
        language === 'hi'
          ? `दस्तावेज़ ${decision === 'approved' ? 'स्वीकृत' : 'अस्वीकृत'} किया गया`
          : `Document ${decision}`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit verification');
    } finally {
      setSubmitting(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{language === 'hi' ? 'स्वीकृत' : 'Approved'}</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{language === 'hi' ? 'अस्वीकृत' : 'Rejected'}</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">{language === 'hi' ? 'लंबित' : 'Pending'}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-orange-600" />
          {t('cscPortal', language)}
        </h1>
        <Badge variant="outline" className="gap-1">
          <Shield className="h-3 w-3" />
          {language === 'hi' ? 'CSC ऑपरेटर' : 'CSC Operator'}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 text-center">
            <Clock className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-yellow-600">{pendingItems.length}</p>
            <p className="text-xs text-gray-400">{language === 'hi' ? 'लंबित' : 'Pending'}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 text-center">
            <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-600">{completedItems.filter(i => i.status === 'approved').length}</p>
            <p className="text-xs text-gray-400">{language === 'hi' ? 'स्वीकृत' : 'Approved'}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 text-center">
            <XCircle className="h-6 w-6 text-red-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-red-600">{completedItems.filter(i => i.status === 'rejected').length}</p>
            <p className="text-xs text-gray-400">{language === 'hi' ? 'अस्वीकृत' : 'Rejected'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Queue Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="h-3 w-3" />
            {language === 'hi' ? 'लंबित' : 'Pending'} ({pendingItems.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {language === 'hi' ? 'पूर्ण' : 'Completed'} ({completedItems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : pendingItems.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-200 mx-auto mb-3" />
                <p className="text-gray-400">{language === 'hi' ? 'कोई लंबित सत्यापन नहीं' : 'No pending verifications'}</p>
              </CardContent>
            </Card>
          ) : (
            pendingItems.map(item => (
              <Card key={item.documentId} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-10 w-10 rounded-lg bg-yellow-50 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{item.documentType.replace(/_/g, ' ')}</p>
                          {statusBadge(item.status)}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {language === 'hi' ? 'उपयोगकर्ता' : 'User'}: {item.userName} • {language === 'hi' ? 'जमा' : 'Submitted'}: {new Date(item.submittedAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-400">
                          OCR {language === 'hi' ? 'विश्वास' : 'Confidence'}: {(item.ocrConfidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <Button size="sm" className="gap-1" onClick={() => handleReview(item)}>
                      <Eye className="h-4 w-4" />
                      {language === 'hi' ? 'समीक्षा करें' : 'Review'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-3 mt-4">
          {completedItems.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400">{language === 'hi' ? 'कोई पूर्ण सत्यापन नहीं' : 'No completed verifications'}</p>
              </CardContent>
            </Card>
          ) : (
            completedItems.map(item => (
              <Card key={item.documentId} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      item.status === 'approved' ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      {statusIcon(item.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{item.documentType.replace(/_/g, ' ')}</p>
                        {statusBadge(item.status)}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.userName} • {item.verifiedAt && new Date(item.verifiedAt).toLocaleDateString()}
                      </p>
                      {item.verifierNotes && (
                        <p className="text-xs text-gray-500 mt-1 italic">&ldquo;{item.verifierNotes}&rdquo;</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-500" />
              {language === 'hi' ? 'दस्तावेज़ समीक्षा' : 'Document Review'}
            </DialogTitle>
            <DialogDescription>
              {language === 'hi'
                ? 'दस्तावेज़ की समीक्षा करें और अपना निर्णय दें'
                : 'Review the document and submit your decision'}
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 mt-2">
              <div className="p-4 rounded-lg bg-gray-50 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{language === 'hi' ? 'दस्तावेज़ प्रकार' : 'Document Type'}</span>
                  <span className="font-medium">{selectedItem.documentType.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{language === 'hi' ? 'उपयोगकर्ता' : 'User'}</span>
                  <span className="font-medium">{selectedItem.userName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">OCR {language === 'hi' ? 'विश्वास' : 'Confidence'}</span>
                  <Badge className={selectedItem.ocrConfidence > 0.8 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                    {(selectedItem.ocrConfidence * 100).toFixed(0)}%
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{language === 'hi' ? 'जमा तिथि' : 'Submitted'}</span>
                  <span className="font-medium">{new Date(selectedItem.submittedAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Document preview from S3 */}
              {selectedItem.documentUrl ? (
                selectedItem.fileType === 'application/pdf' ? (
                  <iframe
                    src={selectedItem.documentUrl}
                    className="w-full h-64 rounded-lg border"
                    title="Document Preview"
                  />
                ) : selectedItem.fileType?.startsWith('image/') ? (
                  <img
                    src={selectedItem.documentUrl}
                    alt={selectedItem.fileName}
                    className="w-full h-64 object-contain rounded-lg border bg-gray-50"
                  />
                ) : (
                  <div className="h-40 rounded-lg bg-gray-100 flex items-center justify-center border">
                    <a href={selectedItem.documentUrl} target="_blank" rel="noopener noreferrer" className="text-center text-blue-600 hover:underline">
                      <FileText className="h-10 w-10 mx-auto mb-1" />
                      <p className="text-sm">{language === 'hi' ? 'दस्तावेज़ डाउनलोड करें' : 'Download Document'}</p>
                    </a>
                  </div>
                )
              ) : (
                <div className="h-40 rounded-lg bg-gray-100 flex items-center justify-center border">
                  <div className="text-center text-gray-400">
                    <FileText className="h-10 w-10 mx-auto mb-1" />
                    <p className="text-xs">{language === 'hi' ? 'पूर्वावलोकन उपलब्ध नहीं' : 'Preview not available'}</p>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{language === 'hi' ? 'निर्णय' : 'Decision'}</label>
                  <Select value={decision} onValueChange={(v: 'approved' | 'rejected') => setDecision(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          {language === 'hi' ? 'स्वीकृत' : 'Approve'}
                        </span>
                      </SelectItem>
                      <SelectItem value="rejected">
                        <span className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          {language === 'hi' ? 'अस्वीकृत' : 'Reject'}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">{language === 'hi' ? 'टिप्पणी' : 'Notes'}</label>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={language === 'hi' ? 'वैकल्पिक टिप्पणी...' : 'Optional notes...'}
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowReview(false)}>
                  {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                </Button>
                <Button
                  className={`flex-1 text-white ${decision === 'approved'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                  }`}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : decision === 'approved' ? (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  {language === 'hi'
                    ? decision === 'approved' ? 'स्वीकृत करें' : 'अस्वीकृत करें'
                    : decision === 'approved' ? 'Approve' : 'Reject'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
