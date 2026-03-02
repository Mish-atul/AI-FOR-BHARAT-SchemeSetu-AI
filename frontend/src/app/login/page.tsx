'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Smartphone, ArrowRight, Shield, Globe } from 'lucide-react';
import { requestOTP, verifyOTP } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const { setLanguage, language } = useAppStore();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (phone.length < 13) {
      toast.error('Please enter a valid phone number');
      return;
    }
    setLoading(true);
    try {
      await requestOTP(phone);
      setStep('otp');
      toast.success('OTP sent to your phone!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter a 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOTP(phone, otp);
      useAppStore.getState().setAuthenticated(true);
      toast.success('Login successful!');
      if (res.requiresConsent || res.isNewUser) {
        router.push('/consent');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-green-50 p-4">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-white to-green-600" />
      
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 via-white to-green-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-xl font-bold text-blue-900">SS</span>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-green-600 bg-clip-text text-transparent">
            SchemeSetu AI
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'hi' ? 'सरकारी योजनाओं के लिए आपका ट्रस्ट वॉलेट' : 'Your Trust Wallet for Government Schemes'}
          </p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
                className="gap-2"
              >
                <Globe className="h-4 w-4" />
                {language === 'en' ? 'हिंदी' : 'English'}
              </Button>
            </div>
            <CardTitle className="text-xl">
              {step === 'phone'
                ? (language === 'hi' ? 'फ़ोन नंबर से लॉगिन' : 'Login with Phone')
                : (language === 'hi' ? 'OTP सत्यापित करें' : 'Verify OTP')}
            </CardTitle>
            <CardDescription>
              {step === 'phone'
                ? (language === 'hi' ? 'अपना फ़ोन नंबर दर्ज करें' : 'Enter your phone number to get started')
                : (language === 'hi' ? `${phone} पर भेजे गए OTP को दर्ज करें` : `Enter the OTP sent to ${phone}`)}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {step === 'phone' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    {language === 'hi' ? 'फ़ोन नंबर' : 'Phone Number'}
                  </Label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10"
                      maxLength={14}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSendOTP}
                  disabled={loading || phone.length < 13}
                  className="w-full bg-gradient-to-r from-orange-500 to-green-600 text-white hover:from-orange-600 hover:to-green-700"
                >
                  {loading ? (language === 'hi' ? 'भेज रहे हैं...' : 'Sending...') : (language === 'hi' ? 'OTP भेजें' : 'Send OTP')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="otp">
                    {language === 'hi' ? 'OTP दर्ज करें' : 'Enter OTP'}
                  </Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={6}
                  />
                </div>
                <Badge variant="secondary" className="w-full justify-center py-1.5 text-xs">
                  💡 {language === 'hi' ? 'डेमो के लिए OTP: 123456' : 'Demo OTP: 123456'}
                </Badge>
                <Button
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-gradient-to-r from-orange-500 to-green-600 text-white hover:from-orange-600 hover:to-green-700"
                >
                  {loading ? (language === 'hi' ? 'सत्यापित हो रहा है...' : 'Verifying...') : (language === 'hi' ? 'OTP सत्यापित करें' : 'Verify OTP')}
                  <Shield className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setStep('phone'); setOtp(''); }}
                  className="w-full"
                >
                  {language === 'hi' ? '← फ़ोन नंबर बदलें' : '← Change phone number'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          {language === 'hi'
            ? 'लॉगिन करके आप हमारी गोपनीयता नीति से सहमत होते हैं'
            : 'By logging in, you agree to our Privacy Policy'}
        </p>
      </div>
    </div>
  );
}
