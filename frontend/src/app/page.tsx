'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Shield, FileText, MessageSquare, BarChart3, Search, Lock,
  Smartphone, Globe, ChevronRight, Star
} from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Document Trust Wallet',
    titleHi: 'दस्तावेज़ ट्रस्ट वॉलेट',
    desc: 'Securely upload and store income documents with blockchain-anchored verification.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: Search,
    title: 'AI Scheme Discovery',
    titleHi: 'AI योजना खोज',
    desc: "Discover government schemes you're eligible for using intelligent profile matching.",
    color: 'from-green-500 to-green-600',
  },
  {
    icon: MessageSquare,
    title: 'Multilingual AI Chatbot',
    titleHi: 'बहुभाषी AI चैटबॉट',
    desc: 'Interact in Hindi or English through text or voice. Powered by Amazon Bedrock.',
    color: 'from-purple-500 to-purple-600',
  },
  {
    icon: BarChart3,
    title: 'Verifiable Income Reports',
    titleHi: 'सत्यापन योग्य आय रिपोर्ट',
    desc: 'Generate QR-coded income reports that banks can verify on the blockchain.',
    color: 'from-orange-500 to-orange-600',
  },
  {
    icon: Shield,
    title: 'Trust Score',
    titleHi: 'ट्रस्ट स्कोर',
    desc: 'Build a verifiable trust score based on document quality and income consistency.',
    color: 'from-teal-500 to-teal-600',
  },
  {
    icon: Lock,
    title: 'Privacy First',
    titleHi: 'गोपनीयता प्रथम',
    desc: 'End-to-end encryption, explicit consent management, and right to data deletion.',
    color: 'from-red-500 to-red-600',
  },
];

const awsServices = [
  'Amazon Bedrock', 'Amazon Textract', 'Amazon Transcribe', 'Amazon Polly',
  'AWS Lambda', 'Amazon DynamoDB', 'Amazon S3', 'AWS KMS',
  'Amazon Cognito', 'API Gateway', 'CloudWatch', 'SQS'
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-green-50" />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-white to-green-600" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center justify-between py-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 via-white to-green-600 flex items-center justify-center shadow-lg">
                <span className="text-sm font-bold text-blue-900">SS</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-green-600 bg-clip-text text-transparent">
                  SchemeSetu AI
                </h1>
                <p className="text-[10px] text-gray-500 -mt-0.5">by Team 0NLY FL4G$</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/verify">
                <Button variant="ghost" size="sm">Verify Report</Button>
              </Link>
              <Link href="/login">
                <Button className="bg-gradient-to-r from-orange-500 to-green-600 text-white hover:from-orange-600 hover:to-green-700">
                  Get Started <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </nav>

          <div className="py-20 lg:py-28 text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-full px-4 py-1.5 text-sm text-orange-700 mb-6">
              <Star className="h-4 w-4 fill-orange-500 text-orange-500" />
              AI for Bharat Hackathon 2026
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Your{' '}
              <span className="bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">
                Trust Wallet
              </span>{' '}
              for Government{' '}
              <span className="bg-gradient-to-r from-green-500 to-green-600 bg-clip-text text-transparent">
                Schemes
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              Empowering India&apos;s 450M+ informal workers with secure document storage,
              verifiable income reports, and AI-powered government scheme discovery.
            </p>
            <p className="text-base text-gray-500 mb-8 max-w-xl mx-auto">
              भारत के 45 करोड़+ अनौपचारिक श्रमिकों को सुरक्षित दस्तावेज़ भंडारण,
              सत्यापन योग्य आय रिपोर्ट, और AI-संचालित सरकारी योजना खोज
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login">
                <Button size="lg" className="bg-gradient-to-r from-orange-500 to-green-600 text-white hover:from-orange-600 hover:to-green-700 text-lg px-8 py-6 shadow-lg">
                  <Smartphone className="mr-2 h-5 w-5" />
                  Start with Phone Number
                </Button>
              </Link>
              <Link href="/verify">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  <Shield className="mr-2 h-5 w-5" />
                  Verify a Report
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything Informal Workers Need</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A complete platform to build financial trust, discover benefits, and access micro-loans.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="group hover:shadow-lg transition-shadow border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{feature.title}</h3>
                  <p className="text-xs text-gray-400 mb-2">{feature.titleHi}</p>
                  <p className="text-sm text-gray-600">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-lg text-gray-600">Simple 4-step process to build your financial trust</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Sign In', desc: 'Login with your phone number using OTP verification', icon: Smartphone },
              { step: '2', title: 'Upload Documents', desc: 'Upload invoices, receipts, and bank statements', icon: FileText },
              { step: '3', title: 'Discover Schemes', desc: 'AI matches you with eligible government schemes', icon: Search },
              { step: '4', title: 'Generate Report', desc: 'Get verifiable income reports with QR codes', icon: BarChart3 },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-100 to-green-100 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-green-600 bg-clip-text text-transparent">{s.step}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AWS Services */}
      <section className="py-16 bg-gradient-to-r from-gray-900 to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Powered by AWS</h2>
          <p className="text-gray-400 mb-8">Built with 12+ AWS services for enterprise-grade reliability</p>
          <div className="flex flex-wrap justify-center gap-3">
            {awsServices.map((service) => (
              <span key={service} className="px-4 py-2 bg-gray-700/50 rounded-full text-sm text-gray-300 border border-gray-600">
                {service}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-orange-50 via-white to-green-50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to Build Your Financial Trust?</h2>
          <p className="text-lg text-gray-600 mb-8">
            Join thousands of informal workers who are accessing government schemes and micro-loans through verified income reports.
          </p>
          <Link href="/login">
            <Button size="lg" className="bg-gradient-to-r from-orange-500 to-green-600 text-white hover:from-orange-600 hover:to-green-700 text-lg px-10 py-6 shadow-lg">
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 via-white to-green-600 flex items-center justify-center">
                <span className="text-xs font-bold text-blue-900">SS</span>
              </div>
              <span className="font-semibold text-white">SchemeSetu AI</span>
            </div>
            <p className="text-sm">Built for AI for Bharat Hackathon 2026 • Team 0NLY FL4G$</p>
            <div className="flex items-center gap-1 text-sm">
              <Globe className="h-4 w-4" />
              <span>Made in India 🇮🇳</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
