'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Shield, FileText, Search } from 'lucide-react';
import { grantConsent } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { toast } from 'sonner';

export default function ConsentPage() {
  const router = useRouter();
  const { language } = useAppStore();
  const [dataConsent, setDataConsent] = useState(false);
  const [schemeConsent, setSchemeConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!dataConsent || !schemeConsent) {
      toast.error(language === 'hi' ? 'कृपया दोनों सहमतियों को स्वीकार करें' : 'Please accept both consents');
      return;
    }
    setLoading(true);
    try {
      await grantConsent('data_processing', 'v1.0');
      await grantConsent('scheme_matching', 'v1.0');
      toast.success(language === 'hi' ? 'सहमति दर्ज की गई!' : 'Consent recorded!');
      router.push('/dashboard');
    } catch {
      toast.error('Failed to record consent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-green-50 p-4">
      <Card className="max-w-lg w-full shadow-xl border-0">
        <CardHeader className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-xl">{t('consentTitle', language)}</CardTitle>
          <CardDescription className="text-sm leading-relaxed mt-2">
            {t('consentDesc', language)}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg border bg-gray-50">
              <FileText className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t('consentData', language)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'hi'
                    ? 'आपके दस्तावेज़ KMS के साथ एन्क्रिप्ट किए जाएंगे और सुरक्षित रूप से S3 में संग्रहीत किए जाएंगे।'
                    : 'Your documents will be encrypted with KMS and stored securely in S3. Only hashes are stored on the blockchain.'}
                </p>
              </div>
              <Switch checked={dataConsent} onCheckedChange={setDataConsent} />
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg border bg-gray-50">
              <Search className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t('consentScheme', language)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'hi'
                    ? 'आपकी प्रोफ़ाइल जानकारी का उपयोग पात्र सरकारी योजनाओं के मिलान के लिए किया जाएगा।'
                    : 'Your profile information will be used to match you with eligible government schemes.'}
                </p>
              </div>
              <Switch checked={schemeConsent} onCheckedChange={setSchemeConsent} />
            </div>
          </div>

          <Button
            onClick={handleAccept}
            disabled={loading || !dataConsent || !schemeConsent}
            className="w-full bg-gradient-to-r from-orange-500 to-green-600 text-white hover:from-orange-600 hover:to-green-700"
          >
            {loading ? t('loading', language) : t('acceptConsent', language)}
          </Button>

          <p className="text-xs text-center text-gray-400">
            {language === 'hi'
              ? 'आप किसी भी समय सेटिंग्स में जाकर अपनी सहमति वापस ले सकते हैं।'
              : 'You can revoke your consent at any time from Settings.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
