'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, CheckCircle2, AlertTriangle, ArrowRight, FileText,
  Star, ExternalLink
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { getEligibleSchemes } from '@/lib/api';
import type { SchemeMatch } from '@/lib/types';

export default function SchemesPage() {
  const { language } = useAppStore();
  const [schemes, setSchemes] = useState<SchemeMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEligibleSchemes()
      .then(setSchemes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const eligible = schemes.filter(s => s.eligibilityScore > 0);
  const notEligible = schemes.filter(s => s.eligibilityScore === 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6 text-green-600" />
            {t('schemeDiscovery', language)}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'hi'
              ? 'आपकी प्रोफ़ाइल के आधार पर 1400+ सरकारी योजनाओं में से मिलान'
              : 'Matched from 1400+ real government schemes on myScheme.gov.in'}
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {eligible.length} {language === 'hi' ? 'पात्र योजनाएं' : 'eligible schemes'}
        </Badge>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : (
        <>
          {/* Eligible Schemes */}
          <div className="space-y-4">
            {eligible.map((scheme) => (
              <Card key={scheme.schemeId} className="border-0 shadow-sm hover:shadow-md transition">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                          <Star className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{scheme.schemeName}</h3>
                          <p className="text-sm text-gray-500 mt-1">{scheme.description}</p>
                        </div>
                      </div>

                      {/* Match Reasons */}
                      <div className="ml-13 space-y-2">
                        {/* Document Match Progress */}
                        {scheme.documentMatch && scheme.documentMatch.percentage > 0 && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-medium text-gray-600 flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {language === 'hi' ? 'दस्तावेज़ मिलान' : 'Document Match'}
                              </span>
                              <span className={`font-bold ${
                                scheme.documentMatch.percentage >= 80 ? 'text-green-600' :
                                scheme.documentMatch.percentage >= 50 ? 'text-yellow-600' : 'text-red-500'
                              }`}>{scheme.documentMatch.percentage}%</span>
                            </div>
                            <Progress value={scheme.documentMatch.percentage} className="h-2" />
                            {scheme.documentMatch.missing.length > 0 && (
                              <p className="text-xs text-gray-400 mt-1">
                                {language === 'hi' ? 'लापता: ' : 'Missing: '}
                                {scheme.documentMatch.missing.map(d => d.replace(/_/g, ' ')).join(', ')}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Benefits */}
                        {scheme.benefits && (
                          <div className="bg-blue-50 rounded-lg p-2 mb-2">
                            <p className="text-xs text-blue-700">
                              <span className="font-medium">{language === 'hi' ? 'लाभ: ' : 'Benefits: '}</span>
                              {scheme.benefits.substring(0, 200)}
                            </p>
                          </div>
                        )}

                        <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                          {t('matchReasons', language)}
                        </p>
                        <div className="space-y-1">
                          {scheme.matchReasons.map((reason, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-green-700">
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                              <span>{reason}</span>
                            </div>
                          ))}
                        </div>

                        {scheme.missingRequirements && scheme.missingRequirements.length > 0 && (
                          <>
                            <p className="text-xs font-medium text-gray-700 uppercase tracking-wide mt-3">
                              {t('missingReqs', language)}
                            </p>
                            <div className="space-y-1">
                              {scheme.missingRequirements.map((req, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-orange-600">
                                  <AlertTriangle className="h-4 w-4 shrink-0" />
                                  <span>{req}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-center md:text-right min-w-[120px]">
                      <div className="inline-flex flex-col items-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl
                          ${scheme.eligibilityScore >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                            scheme.eligibilityScore >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                            'bg-gradient-to-r from-orange-500 to-red-500'}`}>
                          {scheme.eligibilityScore}%
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{t('eligibilityScore', language)}</p>
                      </div>
                      <Button size="sm" className="mt-3 gap-1 bg-green-600 hover:bg-green-700 text-white">
                        {t('howToApply', language)}
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Not Eligible */}
          {notEligible.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-600 mb-3">
                {language === 'hi' ? 'वर्तमान में अपात्र' : 'Currently Not Eligible'}
              </h2>
              <div className="space-y-3">
                {notEligible.map((scheme) => (
                  <Card key={scheme.schemeId} className="border-0 shadow-sm opacity-60">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-sm">{scheme.schemeName}</h3>
                          <p className="text-xs text-gray-400 mt-1">{scheme.description}</p>
                          {scheme.missingRequirements && (
                            <div className="mt-2 space-y-0.5">
                              {scheme.missingRequirements.map((req, i) => (
                                <p key={i} className="text-xs text-red-500">✗ {req}</p>
                              ))}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-red-500 border-red-200">
                          {language === 'hi' ? 'अपात्र' : 'Not Eligible'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
