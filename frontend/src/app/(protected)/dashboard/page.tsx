'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FileText, MessageSquare, BarChart3, Search, Upload,
  TrendingUp, Clock, CheckCircle2, AlertCircle, ArrowRight
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { getDocuments, getEligibleSchemes, getTrustScore } from '@/lib/api';
import type { DocumentMetadata, SchemeMatch, TrustScore } from '@/lib/types';

export default function DashboardPage() {
  const { user, language } = useAppStore();
  const [docs, setDocs] = useState<DocumentMetadata[]>([]);
  const [schemes, setSchemes] = useState<SchemeMatch[]>([]);
  const [trustScore, setTrustScore] = useState<TrustScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDocuments().catch(() => []),
      getEligibleSchemes().catch(() => []),
      getTrustScore().catch(() => null),
    ]).then(([d, s, ts]) => {
      setDocs(d);
      setSchemes(s.filter(sc => sc.eligibilityScore > 0));
      setTrustScore(ts);
      setLoading(false);
    });
  }, []);

  const verifiedDocs = docs.filter(d => d.verificationStatus === 'verified').length;
  const pendingDocs = docs.filter(d => d.verificationStatus === 'pending_review').length;
  const score = trustScore?.score ?? user?.trustScore ?? 0;

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600';
    if (s >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreGradient = (s: number) => {
    if (s >= 80) return 'from-green-500 to-emerald-600';
    if (s >= 60) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-600';
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('welcome', language)}, {user?.profile?.name || (language === 'hi' ? 'उपयोगकर्ता' : 'User')} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {language === 'hi'
              ? 'यहां आपके ट्रस्ट वॉलेट का सारांश है'
              : "Here's an overview of your Trust Wallet"}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {user?.phoneNumber || '+91 XXXXX XXXXX'}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{docs.length}</p>
                <p className="text-xs text-gray-500">{t('totalDocuments', language)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${getScoreGradient(score)} flex items-center justify-center`}>
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</p>
                <p className="text-xs text-gray-500">{t('trustScore', language)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <Search className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{schemes.length}</p>
                <p className="text-xs text-gray-500">{t('eligibleSchemes', language)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingDocs}</p>
                <p className="text-xs text-gray-500">{t('pendingReview', language)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trust Score Detail + Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Trust Score */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('trustScoreBreakdown', language)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r ${getScoreGradient(score)}`}>
                <span className="text-3xl font-bold text-white">{score}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">/100</p>
            </div>
            
            {trustScore?.factors.map((factor) => (
              <div key={factor.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{factor.name}</span>
                  <span className="font-medium">{Math.round(factor.value * 100)}%</span>
                </div>
                <Progress value={factor.value * 100} className="h-2" />
                <p className="text-xs text-gray-400">{language === 'hi' ? `वज़न: ${factor.weight}%` : `Weight: ${factor.weight}%`}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t('quickActions', language)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/documents">
              <Button variant="outline" className="w-full justify-between h-auto py-4 px-4 group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition">
                    <Upload className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{t('uploadDoc', language)}</p>
                    <p className="text-xs text-gray-400">{language === 'hi' ? 'PDF, छवि, या CSV' : 'PDF, Image, or CSV'}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
              </Button>
            </Link>

            <Link href="/chatbot">
              <Button variant="outline" className="w-full justify-between h-auto py-4 px-4 group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition">
                    <MessageSquare className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{t('askAI', language)}</p>
                    <p className="text-xs text-gray-400">{language === 'hi' ? 'हिंदी या अंग्रेजी में बात करें' : 'Chat in Hindi or English'}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
              </Button>
            </Link>

            <Link href="/schemes">
              <Button variant="outline" className="w-full justify-between h-auto py-4 px-4 group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition">
                    <Search className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{t('findSchemes', language)}</p>
                    <p className="text-xs text-gray-400">{language === 'hi' ? 'पात्र योजनाएं खोजें' : 'Discover eligible schemes'}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
              </Button>
            </Link>

            <Link href="/reports">
              <Button variant="outline" className="w-full justify-between h-auto py-4 px-4 group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition">
                    <BarChart3 className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{t('generateReport', language)}</p>
                    <p className="text-xs text-gray-400">{language === 'hi' ? 'QR कोड वाली आय रिपोर्ट' : 'Income report with QR code'}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Documents */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">{t('recentActivity', language)}</CardTitle>
            <Link href="/documents">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                {language === 'hi' ? 'सभी देखें' : 'View All'} <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('noDocuments', language)}</p>
          ) : (
            <div className="space-y-3">
              {docs.slice(0, 5).map((doc) => (
                <div key={doc.documentId} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">{doc.fileName}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(doc.uploadTimestamp).toLocaleDateString()} • ₹{doc.extractedData.amount?.toLocaleString() || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={doc.verificationStatus === 'verified' ? 'default' : doc.verificationStatus === 'pending_review' ? 'secondary' : 'outline'}
                      className={doc.verificationStatus === 'verified' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                      {doc.verificationStatus === 'verified' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {doc.verificationStatus === 'pending_review' && <AlertCircle className="h-3 w-3 mr-1" />}
                      {doc.verificationStatus === 'verified' ? t('verified', language) : doc.verificationStatus === 'pending_review' ? t('pendingReviewStatus', language) : t('unverified', language)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Eligible Schemes */}
      {schemes.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">{t('eligibleSchemes', language)}</CardTitle>
              <Link href="/schemes">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  {language === 'hi' ? 'सभी देखें' : 'View All'} <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-3">
              {schemes.slice(0, 4).map((scheme) => (
                <div key={scheme.schemeId} className="p-4 rounded-lg border bg-gradient-to-r from-green-50 to-emerald-50 hover:shadow-sm transition">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-sm">{scheme.schemeName}</h3>
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                      {scheme.eligibilityScore}%
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">{scheme.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
