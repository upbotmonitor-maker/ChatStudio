import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { User, Sparkles, Image as ImageIcon, Save, Key, HelpCircle } from 'lucide-react';
import { UserProfile } from '../types';

interface ProfileSettingsProps {
  currentUser: UserProfile;
  onProfileUpdate: () => void;
}

export default function ProfileSettings({ currentUser, onProfileUpdate }: ProfileSettingsProps) {
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [photoURL, setPhotoURL] = useState(currentUser.photoURL);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    setDisplayName(currentUser.displayName);
    setBio(currentUser.bio || '');
    setPhotoURL(currentUser.photoURL);
  }, [currentUser]);

  // Upload to ImgBB securely via server proxy
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate is image
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Lütfen geçerli bir görsel dosyası seçin.' });
      return;
    }

    setUploading(true);
    setMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setPhotoURL(result.data.url);
        setMessage({ type: 'success', text: 'Görsel başarıyla güvenli bir şekilde yüklendi!' });
      } else {
        throw new Error(result.error || 'Yükleme başarısız.');
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: `Hata: ${err.message || 'Görsel yüklenemedi.'}` });
    } finally {
      setUploading(false);
    }
  };

  // Save entire profile changes to Firestore
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setMessage({ type: 'error', text: 'Görünür İsim boş bırakılamaz.' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        photoURL: photoURL.trim()
      });

      setMessage({ type: 'success', text: 'Profiliniz başarıyla güncellendi!' });
      onProfileUpdate();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: `Profil güncellenemedi: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-slate-900/40 rounded-3xl border border-slate-800/80">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
          <User className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white font-sans">Profil Ayarları</h2>
          <p className="text-xs text-slate-400">Profil bilgilerinizi, durumunuzu ve görselinizi güncelleyin</p>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm mb-6 border ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Profile Picture Update Area */}
        <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-950/40 border border-slate-800/60 rounded-2xl">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-slate-900 border-2 border-slate-800 overflow-hidden flex items-center justify-center">
              <img 
                src={photoURL} 
                alt="Avatar" 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-slate-950/80 rounded-full flex items-center justify-center">
                <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-3 w-full">
            <div>
              <span className="block text-xs font-semibold text-slate-400 mb-1">Profil Fotoğrafı URL veya Dosya</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Görsel URL girin (veya dosya seçin)"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  className="flex-1 bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 transition-all outline-none"
                />
                <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700/60">
                  <ImageIcon className="w-3.5 h-3.5" /> Seç
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Görünür İsim (Display Name)</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 transition-all outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Kullanıcı Adı (Değiştirilemez)</label>
            <input
              type="text"
              disabled
              value={`@${currentUser.username}`}
              className="w-full bg-slate-950/20 border border-slate-800/40 rounded-xl px-4 py-2.5 text-sm text-slate-500 font-mono select-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Hakkımda (Bio)</label>
          <textarea
            rows={3}
            placeholder="Kendinizden bahsedin..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 transition-all outline-none resize-none leading-relaxed"
          />
        </div>

        <button
          type="submit"
          disabled={saving || uploading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl px-5 py-2.5 shadow-lg shadow-indigo-500/10 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-55"
        >
          {saving ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Profili Kaydet</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
