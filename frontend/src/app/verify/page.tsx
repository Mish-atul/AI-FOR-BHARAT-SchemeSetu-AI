'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ShieldCheck, QrCode, Search, CheckCircle2, XCircle,
  FileText, Calendar, DollarSign, Hash, Loader2, ArrowLeft
} from 'lucide-react';
import { verifyReport } from '@/lib/api';
import type { VerificationResult } from '@/lib/types';

export default function VerifyPage() {
  const [reportId, setReportId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  // Check URL params for report ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('reportId') || params.get('id');
    if (id) {
      setReportId(id);
      handleVerify(id);
    }
  }, []);

  const handleVerify = async (id?: string) => {
    const verifyId = id || reportId;
    if (!verifyId.trim()) return;
    setVerifying(true);
    setError('');
    setResult(null);
    try {
      const res = await verifyReport(verifyId);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleScanQR = async () => {
    setShowScanner(true);
    // In production, use html5-qrcode scanner
    // For demo, simulate a scan after delay
    setTimeout(() => {
      const demoId = 'RPT-' + Date.now().toString(36).toUpperCase();
      setReportId(demoId);
      setShowScanner(false);
      handleVerify(demoId);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 via-white to-green-600 flex items-center justify-center">
            <span className="font-bold text-blue-800 text-sm">SS</span>
          </div>
          <div>
            <h1 className="font-bold text-lg">SchemeSetu AI</h1>
            <p className="text-xs text-gray-500">Report Verification Portal</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
        {/* Verify Card */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-xl">Verify Income Report</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Enter a report ID or scan a QR code to verify the authenticity of an income report on the blockchain.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter Report ID (e.g., RPT-ABC123)"
                value={reportId}
                onChange={e => setReportId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
                className="flex-1"
              />
              <Button
                onClick={() => handleVerify()}
                disabled={verifying || !reportId.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            <div className="relative flex items-center">
              <Separator className="flex-1" />
              <span className="px-3 text-xs text-gray-400 bg-white">OR</span>
              <Separator className="flex-1" />
            </div>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleScanQR}
              disabled={showScanner}
            >
              {showScanner ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Scanning...</>
              ) : (
                <><QrCode className="h-4 w-4" /> Scan QR Code</>
              )}
            </Button>

            {showScanner && (
              <div className="h-48 rounded-lg bg-gray-900 flex items-center justify-center animate-pulse">
                <div className="text-center text-white">
                  <QrCode className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm opacity-50">Camera scanning...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Card className="border-red-200 border shadow-sm">
            <CardContent className="py-6 text-center">
              <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-600 font-medium">Verification Failed</p>
              <p className="text-sm text-gray-500 mt-1">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Verification Result */}
        {result && (
          <Card className={`border shadow-lg ${result.isValid ? 'border-green-200' : 'border-red-200'}`}>
            <CardContent className="py-6 space-y-6">
              {/* Status */}
              <div className="text-center">
                {result.isValid ? (
                  <>
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-green-700">Report Verified ✓</h2>
                    <p className="text-sm text-gray-500">This income report is authentic and has not been tampered with.</p>
                  </>
                ) : (
                  <>
                    <XCircle className="h-16 w-16 text-red-500 mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-red-700">Verification Failed</h2>
                    <p className="text-sm text-gray-500">This report could not be verified. It may have been tampered with.</p>
                  </>
                )}
              </div>

              <Separator />

              {/* Report Details */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  Report Details
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                      <Hash className="h-3 w-3" /> Report ID
                    </p>
                    <p className="text-sm font-medium">{result.reportId}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                      <Calendar className="h-3 w-3" /> Generated
                    </p>
                    <p className="text-sm font-medium">{new Date(result.generatedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                      <DollarSign className="h-3 w-3" /> Total Income
                    </p>
                    <p className="text-sm font-bold text-green-700">₹{result.totalIncome.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                      <Calendar className="h-3 w-3" /> Period
                    </p>
                    <p className="text-sm font-medium">{result.period}</p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                    <ShieldCheck className="h-3 w-3" /> Blockchain Hash
                  </p>
                  <p className="text-xs font-mono break-all">{result.blockchainHash}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 p-3 rounded-lg bg-blue-50">
                    <p className="text-xs text-gray-400 mb-1">Trust Score</p>
                    <p className="text-2xl font-bold text-blue-700">{result.trustScore}/100</p>
                  </div>
                  <div className="flex-1 p-3 rounded-lg bg-purple-50">
                    <p className="text-xs text-gray-400 mb-1">Documents Verified</p>
                    <p className="text-2xl font-bold text-purple-700">{result.verifiedDocuments}/{result.totalDocuments}</p>
                  </div>
                </div>
              </div>

              <div className="text-center pt-2">
                <p className="text-xs text-gray-400">
                  Verified at {new Date(result.verifiedAt).toLocaleString()} via SchemeSetu AI blockchain
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-4">
          <p>SchemeSetu AI — Privacy-First Trust Wallet for India&apos;s Informal Workers</p>
          <p className="mt-1">Built by 0NLY FL4G$ for AI for Bharat Hackathon</p>
        </div>
      </div>
    </div>
  );
}
