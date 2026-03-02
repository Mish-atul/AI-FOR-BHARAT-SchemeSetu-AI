'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  User, Phone, MapPin, Briefcase, Shield, Trash2,
  Save, AlertTriangle, Loader2, Check
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { getProfile, updateProfile, deleteAccount, getConsentStatus } from '@/lib/api';
import type { UserRecord, ConsentRecord } from '@/lib/types';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { language, user, setUser, logout } = useAppStore();
  const [profile, setProfile] = useState<UserRecord | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  useEffect(() => {
    Promise.all([getProfile(), getConsentStatus()])
      .then(([prof, cons]) => {
        setProfile(prof);
        setConsent(Array.isArray(cons) ? cons[0] ?? null : cons);
        const p = prof.profile;
        setName(p?.name ?? '');
        setOccupation(p?.occupation ?? '');
        setDistrict(p?.district ?? '');
        setState(p?.state ?? '');
        setPincode(p?.pincode ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile({ name, occupation, district, state, pincode });
      setProfile(updated);
      setUser({ ...user!, profile: { ...user!.profile, name, occupation, district, state, pincode } });
      toast.success(language === 'hi' ? 'प्रोफ़ाइल अपडेट हो गई!' : 'Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete my account') return;
    setDeleting(true);
    try {
      await deleteAccount('123456');
      toast.success(language === 'hi' ? 'खाता हटा दिया गया' : 'Account deleted');
      logout();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete account');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <User className="h-6 w-6 text-orange-600" />
        {t('profileSettings', language)}
      </h1>

      {/* Profile Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-16 w-16 bg-gradient-to-br from-orange-400 to-green-500">
              <AvatarFallback className="text-white text-xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{profile?.profile?.name}</p>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Phone className="h-3 w-3" />
                +91 {profile?.phoneNumber}
              </p>
              <Badge className="bg-green-100 text-green-700 mt-1 hover:bg-green-100">
                <Shield className="h-3 w-3 mr-1" />
                {language === 'hi' ? 'सत्यापित' : 'Verified'}
              </Badge>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-500">{t('fullName', language)}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-500">{t('occupation', language)}</Label>
              <Input value={occupation} onChange={e => setOccupation(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-500">{t('district', language)}</Label>
                <Input value={district} onChange={e => setDistrict(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-500">{t('state', language)}</Label>
                <Input value={state} onChange={e => setState(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1 max-w-[200px]">
              <Label className="text-xs font-medium text-gray-500">{t('pincode', language)}</Label>
              <Input value={pincode} onChange={e => setPincode(e.target.value)} />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-orange-500 to-green-600 text-white"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t('saving', language)}</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />{t('saveChanges', language)}</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Consent Info */}
      {consent && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              {language === 'hi' ? 'डेटा सहमति' : 'Data Consent'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">{language === 'hi' ? 'डेटा प्रसंस्करण' : 'Data Processing'}</span>
              <Badge className={consent.granted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {consent.granted ? (language === 'hi' ? 'अनुमति दी' : 'Granted') : (language === 'hi' ? 'अस्वीकार' : 'Denied')}
              </Badge>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">{language === 'hi' ? 'सहमति संस्करण' : 'Consent Version'}</span>
              <span className="text-xs text-gray-400">v{consent.version}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">{language === 'hi' ? 'अंतिम अपडेट' : 'Last Updated'}</span>
              <span className="text-xs text-gray-400">{new Date(consent.timestamp).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      <Card className="border-red-200 border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {language === 'hi' ? 'खतरनाक क्षेत्र' : 'Danger Zone'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            {language === 'hi'
              ? 'खाता हटाने से आपका सभी डेटा स्थायी रूप से हटा दिया जाएगा। यह क्रिया पूर्ववत नहीं की जा सकती।'
              : 'Deleting your account will permanently remove all your data. This action cannot be undone.'}
          </p>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t('deleteAccount', language)}
          </Button>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {language === 'hi' ? 'खाता हटाएं' : 'Delete Account'}
            </DialogTitle>
            <DialogDescription>
              {language === 'hi'
                ? 'यह कार्रवाई पूर्ववत नहीं की जा सकती। अपने खाते की पुष्टि करने के लिए "delete my account" टाइप करें।'
                : 'This action cannot be undone. Type "delete my account" to confirm.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="delete my account"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="flex-1">
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteConfirmText.toLowerCase() !== 'delete my account' || deleting}
                onClick={handleDelete}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                {language === 'hi' ? 'स्थायी रूप से हटाएं' : 'Permanently Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
