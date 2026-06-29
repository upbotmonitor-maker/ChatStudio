import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, Lock, Users, MessageSquare, Activity, Trash2, 
  Search, ShieldAlert, KeyRound, ArrowRightLeft, Database, Sparkles,
  Bug, HelpCircle, CheckCircle2, Clock, Filter, AlertCircle, RefreshCw
} from 'lucide-react';
import { UserProfile, Message, AppStats, Feedback } from '../types';
import { GeminiAvatar } from './GeminiAvatar';

interface AdminPanelProps {
  currentUser: UserProfile;
}

export default function AdminPanel({ currentUser }: AdminPanelProps) {
  const [pinInput, setPinInput] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [pinError, setPinError] = useState('');
  
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [allFeedbacks, setAllFeedbacks] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<AppStats>({ totalUsers: 0, totalMessages: 0, activeOnline: 0 });
  
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [logsSearchQuery, setLogsSearchQuery] = useState('');
  const [feedbackSearchQuery, setFeedbackSearchQuery] = useState('');
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState<'all' | 'bug' | 'feature' | 'feedback'>('all');
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<'all' | 'new' | 'reviewed' | 'resolved' | 'rejected'>('all');

  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [successNotification, setSuccessNotification] = useState('');
  const [showDeleteAllUsersConfirm, setShowDeleteAllUsersConfirm] = useState(false);
  const [showDeleteAllMessagesConfirm, setShowDeleteAllMessagesConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);

  // Pin verification
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '9999') {
      setIsAdminUnlocked(true);
      setPinError('');
    } else {
      setPinError('Geçersiz Admin PIN kodu. Lütfen tekrar deneyin.');
      setPinInput('');
    }
  };

  // Listen to Firestore changes for Users, Messages and Feedbacks once unlocked
  useEffect(() => {
    if (!isAdminUnlocked) return;

    // Users Real-time listener
    const usersRef = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
      const uList: UserProfile[] = [];
      let onlineCount = 0;
      
      snapshot.forEach((doc) => {
        const u = doc.data() as UserProfile;
        uList.push(u);
        if (u.status === 'online') {
          onlineCount++;
        }
      });

      setAllUsers(uList);
      setStats((prev) => ({
        ...prev,
        totalUsers: uList.length,
        activeOnline: onlineCount
      }));
    });

    // Messages Real-time listener
    const messagesRef = collection(db, 'messages');
    const unsubscribeMessages = onSnapshot(messagesRef, (snapshot) => {
      const mList: Message[] = [];
      snapshot.forEach((doc) => {
        const m = doc.data() as Message;
        mList.push({ id: doc.id, ...m });
      });

      // Sort logs by time desc
      mList.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });

      setAllMessages(mList);
      setStats((prev) => ({
        ...prev,
        totalMessages: mList.length
      }));
    });

    // Feedbacks Real-time listener
    const feedbacksRef = collection(db, 'feedbacks');
    const unsubscribeFeedbacks = onSnapshot(feedbacksRef, (snapshot) => {
      const fList: Feedback[] = [];
      snapshot.forEach((doc) => {
        const f = doc.data() as Feedback;
        fList.push({ id: doc.id, ...f });
      });

      // Sort feedbacks by createdAt desc
      fList.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });

      setAllFeedbacks(fList);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeMessages();
      unsubscribeFeedbacks();
    };
  }, [isAdminUnlocked]);

  // Update feedback status
  const handleUpdateFeedbackStatus = async (feedbackId: string, newStatus: 'new' | 'reviewed' | 'resolved' | 'rejected') => {
    try {
      const fbRef = doc(db, 'feedbacks', feedbackId);
      await updateDoc(fbRef, { status: newStatus });
      setSuccessNotification('Talep durumu başarıyla güncellendi.');
      setTimeout(() => setSuccessNotification(''), 4000);
    } catch (err) {
      console.error("Error updating feedback status:", err);
      setSuccessNotification('Hata: Durum güncellenemedi.');
      setTimeout(() => setSuccessNotification(''), 4000);
    }
  };

  // Delete feedback
  const handleDeleteFeedback = async (feedbackId: string) => {
    try {
      await deleteDoc(doc(db, 'feedbacks', feedbackId));
      setSuccessNotification('Geri bildirim kalıcı olarak silindi.');
      setTimeout(() => setSuccessNotification(''), 4000);
    } catch (err) {
      console.error("Error deleting feedback:", err);
      setSuccessNotification('Hata: Silme işlemi başarısız.');
      setTimeout(() => setSuccessNotification(''), 4000);
    }
  };

  // Ban / Unban user
  const handleToggleBan = async (user: UserProfile) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        isBanned: !user.isBanned,
        status: !user.isBanned ? 'offline' : user.status // force offline if banned
      });
    } catch (err) {
      console.error("Error toggling ban:", err);
    }
  };

  // Delete user account permanently from database (custom dialog trigger)
  const handleDeleteUser = (user: UserProfile) => {
    setUserToDelete(user);
  };

  const handleExecuteDeleteUser = async () => {
    if (!userToDelete) return;
    const user = userToDelete;
    setUserToDelete(null);

    try {
      // 1. Delete user profile
      await deleteDoc(doc(db, 'users', user.uid));
      
      // 2. Delete unique username index
      await deleteDoc(doc(db, 'usernames', user.username.toLowerCase()));
      
      setSuccessNotification(`"${user.displayName}" (@${user.username}) başarıyla sistemden silindi.`);
      setTimeout(() => setSuccessNotification(''), 4000);
    } catch (err) {
      console.error("Error deleting user:", err);
      setSuccessNotification('Hata: Kullanıcı silinemedi.');
      setTimeout(() => setSuccessNotification(''), 4000);
    }
  };

  const handleExecuteDeleteAllUsers = async () => {
    setShowDeleteAllUsersConfirm(false);
    try {
      // Filter out current admin user to prevent locking out
      const usersToDelete = allUsers.filter(u => u.uid !== currentUser.uid && u.uid !== 'chatstudio_ai');
      
      for (const u of usersToDelete) {
        await deleteDoc(doc(db, 'users', u.uid));
        await deleteDoc(doc(db, 'usernames', u.username.toLowerCase()));
      }
      
      setSuccessNotification('Kendi hesabınız hariç tüm üye hesapları kalıcı olarak silindi.');
      setTimeout(() => setSuccessNotification(''), 4000);
    } catch (err) {
      console.error("Error deleting all users:", err);
      setSuccessNotification('Hata: Tüm üyeler silinirken bir sorun oluştu.');
      setTimeout(() => setSuccessNotification(''), 4000);
    }
  };

  const handleExecuteDeleteMessage = async () => {
    if (!messageToDelete) return;
    const msg = messageToDelete;
    setMessageToDelete(null);
    try {
      if (msg.id) {
        await deleteDoc(doc(db, 'messages', msg.id));
        setSuccessNotification('Sohbet logu başarıyla silindi.');
        setTimeout(() => setSuccessNotification(''), 4000);
      }
    } catch (err) {
      console.error("Error deleting message log:", err);
      setSuccessNotification('Hata: Mesaj silinemedi.');
      setTimeout(() => setSuccessNotification(''), 4000);
    }
  };

  const handleExecuteDeleteAllMessages = async () => {
    setShowDeleteAllMessagesConfirm(false);
    try {
      for (const m of allMessages) {
        if (m.id) {
          await deleteDoc(doc(db, 'messages', m.id));
        }
      }
      setSuccessNotification('Tüm sohbet logları başarıyla veritabanından temizlendi.');
      setTimeout(() => setSuccessNotification(''), 4000);
    } catch (err) {
      console.error("Error clearing all messages:", err);
      setSuccessNotification('Hata: Sohbet logları silinemedi.');
      setTimeout(() => setSuccessNotification(''), 4000);
    }
  };

  // Filter users based on search
  const filteredUsers = allUsers.filter(u => {
    const q = searchUserQuery.toLowerCase();
    return u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  });

  // Filter messages log based on search (sender or message content)
  const filteredLogs = allMessages.filter(m => {
    const q = logsSearchQuery.toLowerCase();
    // Resolve usernames of sender
    const sender = allUsers.find(u => u.uid === m.senderId);
    const receiver = allUsers.find(u => u.uid === m.receiverId);
    
    return (
      m.text.toLowerCase().includes(q) ||
      (sender && sender.displayName.toLowerCase().includes(q)) ||
      (receiver && receiver.displayName.toLowerCase().includes(q))
    );
  });

  // Filter feedbacks based on search and tab selections
  const filteredFeedbacks = allFeedbacks.filter(f => {
    const q = feedbackSearchQuery.toLowerCase();
    const matchesSearch = 
      f.title.toLowerCase().includes(q) ||
      f.message.toLowerCase().includes(q) ||
      f.userDisplayName.toLowerCase().includes(q) ||
      f.userEmail.toLowerCase().includes(q);
      
    const matchesType = feedbackTypeFilter === 'all' || f.type === feedbackTypeFilter;
    const matchesStatus = feedbackStatusFilter === 'all' || f.status === feedbackStatusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getFormatTime = (createdAt: any) => {
    if (!createdAt) return 'Bilinmiyor';
    const date = createdAt.seconds 
      ? new Date(createdAt.seconds * 1000) 
      : new Date(createdAt);
    return date.toLocaleString('tr-TR');
  };

  if (!isAdminUnlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-amber-500 to-indigo-500" />
          
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400 mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Yönetici Girişi</h2>
            <p className="text-xs text-slate-400 text-center mt-1">
              Admin özelliklerine erişmek için 4 haneli şifreyi girin.
            </p>
          </div>

          {pinError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center text-xs text-red-400">
              {pinError}
            </div>
          )}

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <input
              type="password"
              maxLength={4}
              required
              placeholder="••••"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 rounded-xl text-center text-xl font-mono tracking-[1em] py-3 text-white outline-none"
            />

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-red-500 to-indigo-600 hover:from-red-600 hover:to-indigo-700 text-white font-semibold rounded-xl py-3 text-sm cursor-pointer shadow-lg shadow-red-500/10 hover:shadow-red-500/20 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Girişi Doğrula</span>
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 font-sans relative">
      <AnimatePresence>
        {successNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 border border-indigo-500 text-white font-semibold text-xs px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-300 animate-bounce" />
            <span>{successNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Sistem Yönetici Paneli
              <span className="text-[10px] font-bold tracking-wider uppercase bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded">
                GÜVENLİ
              </span>
            </h2>
            <p className="text-xs text-slate-400">Genel istatistikleri, kullanıcı hesaplarını yönetin ve sohbet loglarını izleyin</p>
          </div>
        </div>

        {/* Lock Session */}
        <button
          onClick={() => setIsAdminUnlocked(false)}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 self-start md:self-auto transition-all"
        >
          <Lock className="w-3.5 h-3.5" /> Kilitle (Çıkış)
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Toplam Kullanıcı</span>
            <span className="font-mono text-2xl font-bold text-white">{stats.totalUsers}</span>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Aktif Çevrimiçi</span>
            <span className="font-mono text-2xl font-bold text-emerald-400">{stats.activeOnline}</span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Toplam Mesajlaşma</span>
            <span className="font-mono text-2xl font-bold text-sky-400">{stats.totalMessages}</span>
          </div>
          <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Left Users, Right Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Management */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-bold text-white flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-400" /> Üye Yönetimi
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteAllUsersConfirm(true)}
                className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 text-[10px] font-semibold rounded-lg transition-all cursor-pointer"
                title="Tüm Üyeleri Sil (Kendiniz Hariç)"
              >
                Tümünü Sil
              </button>
              <span className="text-[10px] font-mono text-slate-500">{filteredUsers.length} Listeleniyor</span>
            </div>
          </div>

          {/* User Search Input */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Üye ara (İsim veya @kullanıcı_adı)..."
              value={searchUserQuery}
              onChange={(e) => setSearchUserQuery(e.target.value)}
              className="w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 transition-all outline-none"
            />
          </div>

          {/* Users Table List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <div 
                  key={user.uid}
                  className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-800/60 rounded-xl text-xs"
                >
                  <div className="flex items-center gap-3">
                    {user.uid === 'chatstudio_ai' ? (
                      <GeminiAvatar size="sm" />
                    ) : (
                      <img 
                        src={user.photoURL} 
                        alt="Avatar" 
                        className="w-8 h-8 rounded-full bg-slate-900 object-cover"
                      />
                    )}
                    <div>
                      <div className="font-bold text-slate-200 flex items-center gap-1.5">
                        {user.displayName}
                        {user.isBanned && (
                          <span className="text-[8px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30 px-1 rounded">
                            Banned
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 font-mono text-[10px]">@{user.username} • {user.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle Ban */}
                    <button
                      onClick={() => handleToggleBan(user)}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold border transition-all cursor-pointer ${
                        user.isBanned 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' 
                          : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                      }`}
                    >
                      {user.isBanned ? 'Ban Kaldır' : 'Banla'}
                    </button>

                    {/* Delete Account */}
                    {user.uid !== currentUser.uid && (
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="p-1.5 bg-slate-800 hover:bg-red-900/30 border border-slate-700 hover:border-red-500/40 text-slate-400 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                        title="Üyeliği Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs">Aranan kriterde bir üye bulunamadı.</div>
            )}
          </div>
        </div>

        {/* Live Chat Logs */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-bold text-white flex items-center gap-1.5">
              <Database className="w-4 h-4 text-sky-400" /> Sohbet Veritabanı Logları
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteAllMessagesConfirm(true)}
                className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 text-[10px] font-semibold rounded-lg transition-all cursor-pointer"
                title="Tüm Mesajlaşma Loglarını Temizle"
              >
                Tümünü Temizle
              </button>
              <span className="text-[10px] font-mono text-slate-500">{filteredLogs.length} Mesaj</span>
            </div>
          </div>

          {/* Search Logs */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Mesaj içeriği veya üye ismi ile filtrele..."
              value={logsSearchQuery}
              onChange={(e) => setLogsSearchQuery(e.target.value)}
              className="w-full bg-slate-950/40 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 transition-all outline-none"
            />
          </div>

          {/* Log Items */}
          <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => {
                const sender = allUsers.find(u => u.uid === log.senderId);
                const receiver = allUsers.find(u => u.uid === log.receiverId);
                
                return (
                  <div 
                    key={log.id}
                    className="p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <span className="font-bold text-indigo-400">@{sender?.username || 'silinmis_uye'}</span>
                        <ArrowRightLeft className="w-3 h-3 text-slate-600" />
                        <span className="font-bold text-indigo-400">@{receiver?.username || 'silinmis_uye'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>{getFormatTime(log.createdAt)}</span>
                        <button
                          onClick={() => setMessageToDelete(log)}
                          className="p-1 hover:bg-red-500/10 hover:text-red-400 rounded text-slate-500 cursor-pointer transition-all"
                          title="Bu Mesajı Sil"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-slate-300 bg-slate-950/30 p-2 rounded border border-slate-900 font-mono whitespace-pre-wrap">
                      {log.text}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs">Arşivde kayıtlı sohbet mesajı bulunmuyor.</div>
            )}
          </div>
        </div>
      </div>

      {/* Geri Bildirimler ve Talepler Section */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                Hata Bildirimleri & Geliştirme Talepleri
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {filteredFeedbacks.length} Talep
                </span>
              </h3>
              <p className="text-xs text-slate-400">Kullanıcılardan gelen kaliteli güncelleme isteklerini ve hataları buradan okuyabilir ve durumlarını güncelleyebilirsiniz.</p>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search bar */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Talep başlığı, içerik veya kullanıcı ara..."
              value={feedbackSearchQuery}
              onChange={(e) => setFeedbackSearchQuery(e.target.value)}
              className="w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 transition-all outline-none"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2 bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-1 text-xs text-slate-300">
            <span className="text-[10px] font-bold font-mono text-slate-500 uppercase">Kategori:</span>
            <select
              value={feedbackTypeFilter}
              onChange={(e) => setFeedbackTypeFilter(e.target.value as any)}
              className="bg-transparent text-slate-200 outline-none w-full cursor-pointer font-semibold"
            >
              <option value="all" className="bg-slate-900 text-slate-200">Tümü</option>
              <option value="feature" className="bg-slate-900 text-slate-200">💡 Güncelleme İsteği</option>
              <option value="bug" className="bg-slate-900 text-slate-200">🐛 Hata Bildirimi</option>
              <option value="feedback" className="bg-slate-900 text-slate-200">💬 Genel Öneri</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-1 text-xs text-slate-300">
            <span className="text-[10px] font-bold font-mono text-slate-500 uppercase">Durum:</span>
            <select
              value={feedbackStatusFilter}
              onChange={(e) => setFeedbackStatusFilter(e.target.value as any)}
              className="bg-transparent text-slate-200 outline-none w-full cursor-pointer font-semibold"
            >
              <option value="all" className="bg-slate-900 text-slate-200">Tümü</option>
              <option value="new" className="bg-slate-900 text-slate-200">🆕 Yeni</option>
              <option value="reviewed" className="bg-slate-900 text-slate-200">👀 İncelemede</option>
              <option value="resolved" className="bg-slate-900 text-slate-200">✅ Çözüldü / Tamamlandı</option>
              <option value="rejected" className="bg-slate-900 text-slate-200">❌ Reddedildi</option>
            </select>
          </div>
        </div>

        {/* Feedback List Container */}
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
          {filteredFeedbacks.length > 0 ? (
            filteredFeedbacks.map((f) => {
              // Type styling
              const typeBadge = 
                f.type === 'bug' ? { text: 'Hata Bildirimi', style: 'bg-rose-500/10 border-rose-500/20 text-rose-400' } :
                f.type === 'feature' ? { text: 'Güncelleme İsteği', style: 'bg-violet-500/10 border-violet-500/20 text-violet-400' } :
                { text: 'Genel Öneri', style: 'bg-sky-500/10 border-sky-500/20 text-sky-400' };

              // Priority styling
              const priorityBadge =
                f.priority === 'critical' ? { text: 'Kritik 🚨', style: 'bg-rose-600/25 border-rose-500 text-rose-400 font-bold animate-pulse' } :
                f.priority === 'high' ? { text: 'Yüksek', style: 'bg-amber-500/15 border-amber-500/30 text-amber-400' } :
                f.priority === 'medium' ? { text: 'Orta', style: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' } :
                { text: 'Düşük', style: 'bg-slate-800/40 border-slate-800 text-slate-400' };

              // Status styling
              const statusBadge =
                f.status === 'resolved' ? { text: 'Çözüldü', style: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' } :
                f.status === 'reviewed' ? { text: 'İncelemede', style: 'bg-sky-500/15 border-sky-500/30 text-sky-400' } :
                f.status === 'rejected' ? { text: 'Reddedildi', style: 'bg-slate-800 border-slate-700 text-slate-500' } :
                { text: 'Yeni', style: 'bg-indigo-600/25 border-indigo-500 text-indigo-300 font-bold' };

              return (
                <div 
                  key={f.id}
                  className="p-5 bg-slate-950/40 border border-slate-800/80 rounded-2xl space-y-3.5 relative overflow-hidden transition-all hover:border-slate-700"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    {/* User profile details */}
                    <div className="flex items-center gap-3">
                      <img 
                        src={f.userPhotoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + f.userId} 
                        alt="Avatar" 
                        className="w-8 h-8 rounded-full bg-slate-900 object-cover border border-slate-800"
                      />
                      <div>
                        <div className="font-bold text-slate-200">{f.userDisplayName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{f.userEmail}</div>
                      </div>
                    </div>

                    {/* Badge Pill Group */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:self-center">
                      <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${typeBadge.style}`}>
                        {typeBadge.text}
                      </span>
                      <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${priorityBadge.style}`}>
                        Önem: {priorityBadge.text}
                      </span>
                      <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${statusBadge.style}`}>
                        {statusBadge.text}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 ml-1">
                        {getFormatTime(f.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Message Title & Content */}
                  <div className="space-y-1.5 pl-0 sm:pl-11">
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      {f.title}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 border border-slate-900 p-3.5 rounded-xl whitespace-pre-wrap font-sans">
                      {f.message}
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 sm:pl-11 border-t border-slate-900 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 font-mono uppercase">Durumu Güncelle:</span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { key: 'new', label: 'Yeni', hover: 'hover:bg-indigo-500/10 hover:text-indigo-400' },
                          { key: 'reviewed', label: 'İncelemede', hover: 'hover:bg-sky-500/10 hover:text-sky-400' },
                          { key: 'resolved', label: 'Çözüldü', hover: 'hover:bg-emerald-500/10 hover:text-emerald-400' },
                          { key: 'rejected', label: 'Reddet', hover: 'hover:bg-rose-500/10 hover:text-rose-400' }
                        ].map((btn) => (
                          <button
                            key={btn.key}
                            onClick={() => handleUpdateFeedbackStatus(f.id, btn.key as any)}
                            className={`px-2 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                              f.status === btn.key 
                                ? 'bg-slate-100 text-slate-950 font-bold' 
                                : `bg-slate-900 border border-slate-800 text-slate-400 ${btn.hover}`
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteFeedback(f.id)}
                      className="flex items-center justify-center gap-1 py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-lg text-[10px] font-semibold cursor-pointer transition-all self-end sm:self-auto"
                      title="Sil"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Kalıcı Olarak Sil</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 bg-slate-950/20 border border-slate-800/40 rounded-2xl text-slate-500 text-xs flex flex-col items-center gap-2">
              <Sparkles className="w-6 h-6 text-slate-700 animate-pulse" />
              <span>Aranan kriterlere uygun bir talep veya geri bildirim bulunamadı.</span>
            </div>
          )}
        </div>
      </div>

      {/* User Delete Confirmation Dialog */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-md font-bold text-white">Hesabı Kalıcı Olarak Sil</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    <strong>"{userToDelete.displayName}" (@{userToDelete.username})</strong> kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz!
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl py-2.5 cursor-pointer transition-all border border-slate-700"
                >
                  İptal
                </button>
                <button
                  onClick={handleExecuteDeleteUser}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white text-xs font-semibold rounded-xl py-2.5 cursor-pointer transition-all shadow-lg shadow-red-500/10"
                >
                  Kalıcı Olarak Sil
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete All Users Dialog */}
        {showDeleteAllUsersConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl animate-pulse">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-md font-bold text-white">Tüm Üyeleri Kalıcı Olarak Sil</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Kendi yönetici hesabınız ve Gemini AI hariç, <strong>sistemdeki tüm kayıtlı kullanıcı hesaplarını</strong> silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm üyeler silinir!
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowDeleteAllUsersConfirm(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl py-2.5 cursor-pointer transition-all border border-slate-700"
                >
                  İptal
                </button>
                <button
                  onClick={handleExecuteDeleteAllUsers}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white text-xs font-semibold rounded-xl py-2.5 cursor-pointer transition-all shadow-lg shadow-red-500/10"
                >
                  Tümünü Sil
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete All Messages Dialog */}
        {showDeleteAllMessagesConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-md font-bold text-white">Tüm Sohbet Loglarını Temizle</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Sistemdeki <strong>tüm kullanıcılar arası mesajlaşma geçmişini ve yapay zeka sohbet loglarını</strong> kalıcı olarak temizlemek istiyor musunuz? Bu işlem veritabanındaki tüm mesaj dokümanlarını siler!
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowDeleteAllMessagesConfirm(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl py-2.5 cursor-pointer transition-all border border-slate-700"
                >
                  İptal
                </button>
                <button
                  onClick={handleExecuteDeleteAllMessages}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white text-xs font-semibold rounded-xl py-2.5 cursor-pointer transition-all shadow-lg shadow-red-500/10"
                >
                  Tümünü Temizle
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Single Message Dialog */}
        {messageToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-slate-800 text-slate-300 rounded-2xl">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-md font-bold text-white">Sohbet Mesajını Sil</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Seçilen sohbet mesajını veritabanından kalıcı olarak silmek istiyor musunuz?
                  </p>
                  <p className="text-[11px] font-mono text-indigo-400 bg-slate-950/40 p-2.5 rounded border border-slate-800/60 mt-2.5 whitespace-pre-wrap text-left max-h-[100px] overflow-y-auto">
                    {messageToDelete.text}
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setMessageToDelete(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl py-2.5 cursor-pointer transition-all border border-slate-700"
                >
                  İptal
                </button>
                <button
                  onClick={handleExecuteDeleteMessage}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white text-xs font-semibold rounded-xl py-2.5 cursor-pointer transition-all shadow-lg shadow-red-500/10"
                >
                  Mesajı Sil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
