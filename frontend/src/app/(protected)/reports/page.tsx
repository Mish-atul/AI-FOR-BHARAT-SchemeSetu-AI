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
import { jsPDF } from 'jspdf';

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

  const downloadPDF = async (report: IncomeReport) => {
    try {
      const doc = new jsPDF();
      const qrDataUrl = await QRCode.toDataURL(report.qrCodeData, { width: 200, margin: 1 });

      // Header
      doc.setFillColor(255, 153, 0);
      doc.rect(0, 0, 210, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text('SchemeSetu AI', 15, 18);
      doc.setFontSize(10);
      doc.text('Verifiable Income Report', 15, 27);
      doc.setFontSize(8);
      doc.text(`Report ID: ${report.reportId}`, 120, 18);
      doc.text(`Generated: ${new Date(report.generatedAt).toLocaleDateString()}`, 120, 24);

      // Report period
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text('Report Period', 15, 48);
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`${new Date(report.period.start).toLocaleDateString()} to ${new Date(report.period.end).toLocaleDateString()}`, 15, 56);

      // Income Summary
      doc.setDrawColor(200, 200, 200);
      doc.line(15, 62, 195, 62);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.text('Income Summary', 15, 74);

      doc.setFontSize(11);
      const y = 84;
      doc.setTextColor(60, 60, 60);
      doc.text('Total Income:', 20, y);
      doc.setTextColor(0, 128, 0);
      doc.text(`Rs. ${report.totalIncome.toLocaleString()}`, 80, y);

      doc.setTextColor(60, 60, 60);
      doc.text('Avg Monthly Income:', 20, y + 10);
      doc.setTextColor(0, 100, 200);
      doc.text(`Rs. ${report.averageMonthlyIncome.toLocaleString()}`, 80, y + 10);

      doc.setTextColor(60, 60, 60);
      doc.text('Documents Used:', 20, y + 20);
      doc.text(`${report.verifiedDocumentCount} verified / ${report.documentCount} total`, 80, y + 20);

      // Trust Score
      doc.line(15, y + 30, 195, y + 30);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.text('Trust Score', 15, y + 42);

      doc.setFontSize(28);
      const scoreColor = report.trustScore >= 70 ? [0, 150, 0] : report.trustScore >= 40 ? [200, 150, 0] : [200, 0, 0];
      doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.text(`${report.trustScore}/100`, 20, y + 58);

      // Trust factors
      const factors = (report as any).trustFactors;
      if (factors) {
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        let fy = y + 68;
        doc.text(`Document Quality: ${(factors.docQualityScore * 100).toFixed(0)}%  (weight: 40%)`, 20, fy);
        doc.text(`Income Stability: ${(factors.incomeStabilityScore * 100).toFixed(0)}%  (weight: 30%)`, 20, fy + 7);
        doc.text(`Recency: ${(factors.recencyScore * 100).toFixed(0)}%  (weight: 15%)`, 20, fy + 14);
        doc.text(`Source Reliability: ${(factors.sourceReliabilityScore * 100).toFixed(0)}%  (weight: 15%)`, 20, fy + 21);
      }

      // QR Code
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text('Blockchain Verification', 120, y + 42);
      doc.addImage(qrDataUrl, 'PNG', 130, y + 46, 50, 50);
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('Scan to verify on blockchain', 135, y + 100);

      // Hash
      doc.line(15, y + 108, 195, y + 108);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Blockchain Hash: ${report.reportHash}`, 15, y + 116);

      // Footer
      doc.setFillColor(240, 240, 240);
      doc.rect(0, 275, 210, 22, 'F');
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.text('This report is generated by SchemeSetu AI and anchored to an immutable blockchain ledger.', 15, 282);
      doc.text('Verify authenticity by scanning the QR code or visiting schemesetu.ai/verify', 15, 287);

      doc.save(`SchemeSetu_Report_${report.reportId}.pdf`);
      toast.success(language === 'hi' ? 'PDF डाउनलोड हो गया!' : 'PDF downloaded!');
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast.error(language === 'hi' ? 'PDF बनाने में त्रुटि' : 'Failed to generate PDF');
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
                    <Button variant="outline" size="sm" className="gap-1 flex-1" onClick={() => downloadPDF(report)}>
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
