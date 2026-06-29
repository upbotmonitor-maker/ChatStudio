import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { ShoppingBag, Coins, Sparkles, Check, Flame, Clock } from 'lucide-react';
import { UserProfile } from '../types';

interface ShopProps {
  currentUser: UserProfile;
  onProfileUpdate: () => void;
}

export default function Shop({ currentUser, onProfileUpdate }: ShopProps) {
  const [gifUrlInput, setGifUrlInput] = useState(currentUser.gifUrl || '');
  const [buying, setBuying] = useState(false);
  const [savingGif, setSavingGif] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Purchase GIF privilege
  const handlePurchase = async (days: number, price: number) => {
    if (currentUser.coins < price) {
      setMessage({ type: 'error', text: 'Yetersiz bakiye! Sohbet ederek veya günlük bonuslarla bakiye biriktirin.' });
      return;
    }

    setBuying(true);
    setMessage({ type: '', text: '' });

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const startTime = new Date();
      const expireTime = new Date();
      expireTime.setDate(startTime.getDate() + days);

      await updateDoc(userRef, {
        coins: currentUser.coins - price,
        gifEnabled: true,
        gifStartTime: startTime,
        gifExpireTime: expireTime,
        // Keep existing gifUrl or clear it if first purchase
        gifUrl: currentUser.gifUrl || 'https://media.giphy.com/media/l41lI4bYucsjjg0De/giphy.gif'
      });

      setMessage({ 
        type: 'success', 
        text: `Başarıyla ${days} Günlük Profil GIF Hakkı satın aldınız! Aşağıdan GIF URL'nizi güncelleyebilirsiniz.` 
      });
      onProfileUpdate();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: `Satın alma başarısız: ${err.message}` });
    } finally {
      setBuying(false);
    }
  };

  // Save/Update GIF URL
  const handleSaveGif = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gifUrlInput.trim()) {
      setMessage({ type: 'error', text: 'Lütfen geçerli bir GIF URL\'si girin.' });
      return;
    }

    setSavingGif(true);
    setMessage({ type: '', text: '' });

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        gifUrl: gifUrlInput.trim()
      });

      setMessage({ type: 'success', text: 'Profil GIF URL\'niz başarıyla kaydedildi!' });
      onProfileUpdate();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: `GIF kaydedilemedi: ${err.message}` });
    } finally {
      setSavingGif(false);
    }
  };

  // Remaining GIF time calculation
  const getRemainingTime = () => {
    if (!currentUser.gifEnabled || !currentUser.gifExpireTime) return null;
    const expireTime = currentUser.gifExpireTime.seconds 
      ? currentUser.gifExpireTime.seconds * 1000 
      : new Date(currentUser.gifExpireTime).getTime();
    
    const diff = expireTime - Date.now();
    if (diff <= 0) return 'Süresi Doldu';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} saat ${mins} dakika kaldı`;
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8 font-sans">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 animate-pulse">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">ChatStudio Mağaza</h2>
            <p className="text-xs text-slate-400">Coins harcayarak profilinizi özelleştirecek ayrıcalıklar satın alın</p>
          </div>
        </div>

        {/* Coins display */}
        <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-2xl flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-500" />
          <span className="font-mono font-bold text-amber-400">{currentUser.coins ?? 0} CSC</span>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm border ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Main Items Shelf */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* GIF Product card 1 */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 font-semibold text-lg flex items-center justify-center">
                🎞️
              </span>
              <div>
                <h3 className="font-bold text-slate-100 group-hover:text-white transition-colors">1 Günlük Profil GIF Hakkı</h3>
                <p className="text-[11px] text-slate-400">Profil kartında 24 saat hareketli GIF oynatın</p>
              </div>
            </div>

            <ul className="text-xs text-slate-400 space-y-2 mt-4 pl-1">
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-indigo-400" /> Profil kartında otomatik oynatılır
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-indigo-400" /> Kullanıcı listesinde statiktir (hızlı yüklenir)
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-indigo-400" /> Tam 24 saat boyunca aktiftir
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between">
            <span className="font-mono text-sm font-bold text-amber-400 flex items-center gap-1">
              <Coins className="w-4 h-4" /> 50 CSC
            </span>
            <button
              onClick={() => handlePurchase(1, 50)}
              disabled={buying || currentUser.coins < 50}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Satın Al
            </button>
          </div>
        </div>

        {/* GIF Product card 2 */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute top-3 right-3 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Flame className="w-2.5 h-2.5" /> Popüler
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-sky-500/10 rounded-xl text-sky-400 font-semibold text-lg flex items-center justify-center">
                🎞️
              </span>
              <div>
                <h3 className="font-bold text-slate-100 group-hover:text-white transition-colors">2 Günlük Profil GIF Hakkı</h3>
                <p className="text-[11px] text-slate-400">Profil kartında 48 saat hareketli GIF oynatın</p>
              </div>
            </div>

            <ul className="text-xs text-slate-400 space-y-2 mt-4 pl-1">
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-sky-400" /> Profil kartında otomatik oynatılır
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-sky-400" /> Kullanıcı listesinde statiktir (hızlı yüklenir)
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-sky-400" /> Tam 48 saat boyunca aktiftir (%20 tasarruf!)
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between">
            <span className="font-mono text-sm font-bold text-amber-400 flex items-center gap-1">
              <Coins className="w-4 h-4" /> 80 CSC
            </span>
            <button
              onClick={() => handlePurchase(2, 80)}
              disabled={buying || currentUser.coins < 80}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Satın Al
            </button>
          </div>
        </div>
      </div>

      {/* Active GIF Configurator Section (Shown only if GIF enabled) */}
      <div className="bg-slate-950/40 border border-slate-800/60 rounded-3xl p-6">
        <h3 className="text-md font-bold text-white mb-2 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-400" /> Profil GIF Yönetimi
        </h3>

        {currentUser.gifEnabled ? (
          <div className="space-y-4">
            <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-center justify-between text-xs">
              <span className="text-indigo-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Durum: Aktif
              </span>
              <span className="font-mono text-slate-300">{getRemainingTime()}</span>
            </div>

            <form onSubmit={handleSaveGif} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Profil GIF Bağlantısı (GIF URL)
                </label>
                <input
                  type="text"
                  placeholder="https://media.giphy.com/media/.../giphy.gif"
                  value={gifUrlInput}
                  onChange={(e) => setGifUrlInput(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 transition-all outline-none font-mono"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <button
                  type="submit"
                  disabled={savingGif}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {savingGif ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>GIF Kaydet</span>
                  )}
                </button>

                {currentUser.gifUrl && (
                  <div className="text-[11px] text-slate-500">
                    Önizleme Profil Kartınız açıldığında otomatik oynatılacaktır.
                  </div>
                )}
              </div>
            </form>
          </div>
        ) : (
          <div className="py-6 text-center">
            <p className="text-sm text-slate-400 font-medium">Aktif Profil GIF hakkınız bulunmuyor.</p>
            <p className="text-xs text-slate-500 mt-1">Süreli GIF özelliğini kullanmak için yukarıdaki paketlerden satın alabilirsiniz.</p>
          </div>
        )}
      </div>
    </div>
  );
}
