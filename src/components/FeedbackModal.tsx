import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Send, Sparkles, Bug, MessageSquare, AlertTriangle, 
  CheckCircle2, Loader2, ArrowUpRight, HelpCircle
} from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, Feedback } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, userId?: string, email?: string) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId,
      email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface FeedbackModalProps {
  currentUser: UserProfile;
  onClose: () => void;
}

export function FeedbackModal({ currentUser, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<'bug' | 'feature' | 'feedback'>('feature');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');

    const feedbackId = 'fb_' + Math.random().toString(36).substring(2, 15);
    const feedbackPath = `feedbacks/${feedbackId}`;

    try {
      const feedbackData = {
        id: feedbackId,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userDisplayName: currentUser.displayName,
        userPhotoURL: currentUser.photoURL || '',
        type,
        title: title.trim(),
        message: message.trim(),
        priority,
        status: 'new',
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'feedbacks', feedbackId), feedbackData);
      
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2500);

    } catch (error) {
      setErrorMsg('Talep gönderilirken hata oluştu. Lütfen tekrar deneyin.');
      try {
        handleFirestoreError(error, OperationType.WRITE, feedbackPath, currentUser.uid, currentUser.email);
      } catch (err) {
        // Log handled error
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
      />

      {/* Modal Container */}
      <motion.div 
        initial={{ scale: 0.95, y: 15, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 15, opacity: 0 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="relative w-full max-w-lg bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden z-10"
      >
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/4 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500/20 to-indigo-600/30 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                    {type === 'feature' ? (
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    ) : type === 'bug' ? (
                      <Bug className="w-5 h-5" />
                    ) : (
                      <MessageSquare className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Geliştirme & Destek Merkezi</h3>
                    <p className="text-xs text-slate-400">Uygulamayı güzelleştirmek için bize önerilerini ilet.</p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800/40 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-2 font-mono uppercase tracking-wider">Kategori</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setType('feature')}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                        type === 'feature'
                          ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Güncelleme</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setType('bug')}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                        type === 'bug'
                          ? 'bg-rose-600/25 border-rose-500 text-white shadow-lg shadow-rose-500/10'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <Bug className="w-3.5 h-3.5 text-rose-400" />
                      <span>Hata Bildir</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setType('feedback')}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                        type === 'feedback'
                          ? 'bg-sky-600/25 border-sky-500 text-white shadow-lg shadow-sky-500/10'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                      <span>Genel Öneri</span>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1.5 font-mono uppercase tracking-wider">Kısa Başlık</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value.substring(0, 100))}
                    placeholder={type === 'feature' ? 'Örn: Dosya gönderme özelliği gelsin' : type === 'bug' ? 'Örn: Profil fotoğrafı yüklerken donuyor' : 'Örn: Arayüz renkleri hakkında'}
                    className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Message */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">Detaylı Açıklama</label>
                    <span className="text-[10px] text-slate-500 font-mono">{message.length}/500</span>
                  </div>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value.substring(0, 500))}
                    placeholder={type === 'feature' 
                      ? 'İstediğiniz özelliği detaylıca anlatın. Ne işe yarayacak? Nasıl çalışmalı?' 
                      : type === 'bug' 
                      ? 'Hatayı nasıl aldınız? Adım adım açıklayın. Hangi ekranda oldu?' 
                      : 'Lütfen düşüncelerinizi, eleştirilerinizi veya önerilerinizi paylaşın.'}
                    className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                  />
                </div>

                {/* Priority Selection */}
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1.5 font-mono uppercase tracking-wider">Önem Derecesi</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: 'low', label: 'Düşük', color: 'text-slate-400 bg-slate-800/30' },
                      { key: 'medium', label: 'Orta', color: 'text-indigo-400 bg-indigo-500/10' },
                      { key: 'high', label: 'Yüksek', color: 'text-amber-400 bg-amber-500/10' },
                      { key: 'critical', label: 'Kritik 🚨', color: 'text-rose-400 bg-rose-500/10' }
                    ].map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setPriority(p.key as any)}
                        className={`py-2 px-1 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                          priority === p.key
                            ? 'bg-slate-100 text-slate-950 border-white font-bold'
                            : `${p.color} border-slate-800/80 hover:border-slate-700`
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 bg-slate-950/40 hover:bg-slate-800 border border-slate-800/80 text-slate-300 font-semibold py-3 px-4 rounded-xl text-xs cursor-pointer transition-all"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !title.trim() || !message.trim()}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-xs cursor-pointer shadow-lg shadow-indigo-600/10 active:scale-95 transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gönderiliyor...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Talebi İlet</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center text-center py-8"
            >
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Harika, Başarıyla Alındı!</h3>
              <p className="text-slate-400 text-sm max-w-sm mt-2 leading-relaxed">
                İlettiğin talep doğrudan yönetici paneline düştü. İnceleyip en kısa sürede harekete geçeceğiz.
              </p>
              <div className="mt-6 flex items-center gap-1.5 text-xs text-indigo-400 font-mono">
                <span>ChatStudio'yu geliştirmemize yardım ettiğin için teşekkürler</span>
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
