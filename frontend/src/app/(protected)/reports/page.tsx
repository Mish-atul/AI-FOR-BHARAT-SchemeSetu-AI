'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3, FileText, Download, QrCode, Calendar, DollarSign,
  TrendingUp, CheckCircle2, Loader2
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { generateReport, getReports } from '@/lib/api';
import type { IncomeReport } from '@/lib/types';
import { toast } from 'sonner';
import QRCode from 'qrcode';

export default function ReportsPage() {
  const { language } = useAppStore();
  const [reports, setReports] = useState<IncomeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [selectedReport, setSelectedReport] = useState<IncomeReport | null>(null);

  useEffect(() => {
    getReports()
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      toast.error(language === 'hi' ? 'कृपया तिथि सीमा चुनें' : 'Please select a date range');
      return;
    }
    setGenerating(true);
    try {
      const report = await generateReport(startDate, endDate);
      setReports([report, ...reports]);
      toast.success(language === 'hi' ? 'रिपोर्ट बन गई!' : 'Report generated successfully!');
      setStartDate('');
      setEndDate('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const showQRCode = async (report: IncomeReport) => {
    try {
      const dataUrl = await QRCode.toDataURL(report.qrCodeData, { width: 256, margin: 2 });
      setQrDataUrl(dataUrl);
      setSelectedReport(report);
      setShowQR(true);
    } catch {
      toast.error('Failed to generate QR code');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-orange-600" />
        {t('incomeReports', language)}
      </h1>

      {/* Generate Report */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('generateNewReport', language)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">{t('startDate', language)}</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('endDate', language)}</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleGenerate}
                disabled={generating || !startDate || !endDate}
                className="w-full bg-gradient-to-r from-orange-500 to-green-600 text-white"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t('generating', language)}</>
                ) : (
                  <>{t('generate', language)}</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <div className="space-y-4">
        {loading ? (
          [1, 2].map(i => <Skeleton key={i} className="h-48 w-full" />)
        ) : reports.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">{t('noReports', language)}</p>
            </CardContent>
          </Card>
        ) : (
          reports.map((report) => (
            <Card key={report.reportId} className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {language === 'hi' ? 'सत्यापित' : 'Verified'}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {new Date(report.generatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500 mb-4">
                      {language === 'hi' ? 'अवधि' : 'Period'}: {new Date(report.period.start).toLocaleDateString()} — {new Date(report.period.end).toLocaleDateString()}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 rounded-lg bg-green-50">
                        <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                          <DollarSign className="h-3 w-3" />
                          {t('totalIncome', language)}
                        </div>
                        <p className="font-bold text-lg text-green-700">₹{report.totalIncome.toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-blue-50">
                        <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                          <TrendingUp className="h-3 w-3" />
                          {t('avgMonthlyIncome', language)}
                        </div>
                        <p className="font-bold text-lg text-blue-700">₹{report.averageMonthlyIncome.toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-purple-50">
                        <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                          <FileText className="h-3 w-3" />
                          {t('verifiedDocs', language)}
                        </div>
                        <p className="font-bold text-lg text-purple-700">{report.verifiedDocumentCount}/{report.documentCount}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-orange-50">
                        <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                          <TrendingUp className="h-3 w-3" />
                          {t('trustScore', language)}
                        </div>
                        <p className="font-bold text-lg text-orange-700">{report.trustScore}/100</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col gap-2 md:min-w-[120px]">
                    <Button variant="outline" size="sm" className="gap-1 flex-1" onClick={() => showQRCode(report)}>
                      <QrCode className="h-4 w-4" />
                      {t('viewQR', language)}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 flex-1">
                      <Download className="h-4 w-4" />
                      {t('downloadPDF', language)}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 p-2 rounded bg-gray-50 flex items-center gap-2">
                  <code className="text-xs text-gray-500 flex-1 truncate">Hash: {report.reportHash}</code>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>{language === 'hi' ? 'सत्यापन QR कोड' : 'Verification QR Code'}</DialogTitle>
          </DialogHeader>
          {qrDataUrl && (
            <div className="flex flex-col items-center gap-4">
              <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
              <p className="text-xs text-gray-500 max-w-xs break-all">
                {selectedReport?.qrCodeData}
              </p>
              <p className="text-xs text-gray-400">
                {language === 'hi'
                  ? 'बैंक या सत्यापनकर्ता इस QR कोड को स्कैन करके आपकी आय रिपोर्ट की प्रामाणिकता सत्यापित कर सकते हैं।'
                  : 'Banks and verifiers can scan this QR code to verify the authenticity of your income report on the blockchain.'}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
