import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Activity, Coins, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';
import { GeminiAvatar } from './GeminiAvatar';

interface ProfileCardProps {
  user: UserProfile;
  currentUser: UserProfile | null;
  onClose: () => void;
  onProfileUpdate?: () => void;
}

export default function ProfileCard({ user, currentUser, onClose, onProfileUpdate }: ProfileCardProps) {
  const [activePhoto, setActivePhoto] = useState(user.photoURL);
  const [gifActive, setGifActive] = useState(user.gifEnabled);

  useEffect(() => {
    // GIF expiration check
    if (user.gifEnabled && user.gifExpireTime) {
      let expired = false;
      
      // Handle Firestore Timestamp or standard Dates
      const expireTime = user.gifExpireTime.seconds 
        ? user.gifExpireTime.seconds * 1000 
        : new Date(user.gifExpireTime).getTime();

      if (Date.now() > expireTime) {
        expired = true;
      }

      if (expired) {
        setGifActive(false);
        setActivePhoto(user.photoURL);
        
        // Auto-update Firestore to clean up expired GIF
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, {
          gifEnabled: false,
          gifUrl: '',
          gifStartTime: null,
          gifExpireTime: null
        }).then(() => {
          if (onProfileUpdate) onProfileUpdate();
        }).catch(err => console.error("GIF expire update failed:", err));
      } else {
        setGifActive(true);
        setActivePhoto(user.gifUrl);
      }
    } else {
      setGifActive(false);
      setActivePhoto(user.photoURL);
    }
  }, [user, onProfileUpdate]);

  // Format date
  const getRegDate = () => {
    if (!user.createdAt) return 'Bilinmiyor';
    const date = user.createdAt.seconds 
      ? new Date(user.createdAt.seconds * 1000) 
      : new Date(user.createdAt);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        />

        {/* Card Content */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          className="relative w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl z-10 overflow-hidden"
        >
          {/* Top banner styling */}
          <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-r from-indigo-600/20 to-sky-500/20" />

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-slate-950/40 text-slate-400 hover:text-white rounded-full border border-slate-800 transition-colors cursor-pointer z-20"
          >
            <X className="w-4 h-4" />
          </button>

          {/* User Visual Detail */}
          <div className="relative flex flex-col items-center mt-6">
            <div className="relative">
              {/* Profile Image container */}
              {user.uid === 'chatstudio_ai' ? (
                <GeminiAvatar size="lg" className="border-4 border-slate-900 shadow-xl" />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-slate-900 bg-slate-950 overflow-hidden shadow-xl flex items-center justify-center relative">
                  <img 
                    src={activePhoto} 
                    alt={user.displayName} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Status Indicator Pill */}
              <span className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-4 border-slate-900 flex items-center justify-center ${
                user.status === 'online' ? 'bg-emerald-500' : 'bg-slate-500'
              }`} />
            </div>

            {/* Display Name */}
            <h2 className="text-xl font-bold text-white mt-4 flex items-center gap-1.5">
              {user.displayName}
            </h2>

            {/* Username */}
            <p className="text-indigo-400 text-sm font-mono mt-0.5">@{user.username}</p>
          </div>

          {/* Bio Description */}
          <div className="mt-6 bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Hakkımda</h3>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {user.bio || 'Henüz bir biyografi yazılmamış.'}
            </p>
          </div>

          {/* User Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-slate-950/30 border border-slate-800/40 rounded-xl p-3 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-0.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Kayıt Tarihi</span>
              </div>
              <p className="text-xs font-semibold text-slate-200 mt-1">{getRegDate()}</p>
            </div>

            <div className="bg-slate-950/30 border border-slate-800/40 rounded-xl p-3 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-0.5">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                <span>Durum</span>
              </div>
              <p className={`text-xs font-semibold mt-1 ${
                user.status === 'online' ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                {user.status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}
              </p>
            </div>
          </div>

          {/* If the profile is of current user */}
          {currentUser && currentUser.uid === user.uid && (
            <p className="text-center text-[10px] text-slate-500 mt-4">
              Bu sizin profilinizdir. Düzenlemek için Ayarlar menüsünü kullanabilirsiniz.
            </p>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
