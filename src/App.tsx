import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  collection 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, ShoppingBag, Settings, ShieldAlert, LogOut, 
  User, Sparkles, Coins, Menu, X, Check 
} from 'lucide-react';
import Auth from './components/Auth';
import UserList from './components/UserList';
import ChatArea from './components/ChatArea';
import ProfileCard from './components/ProfileCard';
import ProfileSettings from './components/ProfileSettings';
import Shop from './components/Shop';
import AdminPanel from './components/AdminPanel';
import { UserProfile } from './types';

// Virtual AI User Object
const aiUser: UserProfile = {
  uid: 'chatstudio_ai',
  username: 'gemini',
  displayName: 'Gemini AI',
  email: 'gemini@chatstudio.com',
  photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=G',
  bio: 'Resmi Gemini Yapay Zeka Asistanı.\n\nSistemlerin optimize edilmesine yardımcı olur, sorularınızı yanıtlar ve akıllı rehberlik sağlar.',
  status: 'online',
  createdAt: null,
  role: 'admin',
  isBanned: false,
  coins: 0,
  gifEnabled: false,
  gifUrl: '',
  gifStartTime: null,
  gifExpireTime: null
};

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'shop' | 'settings' | 'admin'>('chat');
  const [profileModalUser, setProfileModalUser] = useState<UserProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Parse location hash for routes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#/admin-secret-access') {
        setActiveTab('admin');
      } else if (hash === '#/settings') {
        setActiveTab('settings');
      } else {
        setActiveTab('chat');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // run on mount

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Sync hash with active tab state
  const changeTab = (tab: 'chat' | 'shop' | 'settings' | 'admin') => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    if (tab === 'admin') {
      window.location.hash = '#/admin-secret-access';
    } else if (tab === 'settings') {
      window.location.hash = '#/settings';
    } else {
      window.location.hash = '#/';
    }
  };

  // Auth observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        localStorage.setItem('chatstudio_uid', user.uid);
      } else {
        const localUid = localStorage.getItem('chatstudio_uid');
        if (localUid) {
          setUserId(localUid);
        } else {
          setUserId(null);
          setCurrentUser(null);
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Current User profile subscription and status sync
  useEffect(() => {
    if (!userId) return;

    const userDocRef = doc(db, 'users', userId);
    
    // Set status online upon load
    setDoc(userDocRef, { status: 'online' }, { merge: true });

    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const uData = snapshot.data() as UserProfile;
        
        // Handle auto login-kick if banned on live session
        if (uData.isBanned) {
          handleLogout();
          alert('Hesabınız askıya alınmıştır.');
          return;
        }

        setCurrentUser(uData);
      } else {
        // If the user profile document is deleted or doesn't exist, log them out gracefully
        handleLogout();
      }
      setLoading(false);
    }, (err) => {
      console.error("Profile listen error:", err);
      setLoading(false);
    });

    // Offline status update handler on tab close
    const handleTabClose = () => {
      setDoc(userDocRef, { status: 'offline' }, { merge: true });
    };

    window.addEventListener('beforeunload', handleTabClose);

    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
      // set offline on unmount
      setDoc(userDocRef, { status: 'offline' }, { merge: true });
      unsubscribe();
    };
  }, [userId]);

  // Load all users from Firestore
  useEffect(() => {
    if (!userId) return;

    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const uList: UserProfile[] = [];
      
      // Inject Virtual AI User first
      uList.push(aiUser);

      snapshot.forEach((docSnap) => {
        const u = docSnap.data() as UserProfile;
        // Make sure we don't duplicate AI or include banned/deleted accounts
        if (u.uid !== 'chatstudio_ai') {
          uList.push(u);
        }
      });

      // Sort: Online users first, then alphabetic
      uList.sort((a, b) => {
        if (a.uid === 'chatstudio_ai') return -1;
        if (b.uid === 'chatstudio_ai') return 1;
        if (a.status === 'online' && b.status === 'offline') return -1;
        if (a.status === 'offline' && b.status === 'online') return 1;
        return a.displayName.localeCompare(b.displayName);
      });

      setUsers(uList);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleLogout = async () => {
    if (userId) {
      // Set status to offline before signing out
      try {
        const userDocRef = doc(db, 'users', userId);
        await setDoc(userDocRef, { status: 'offline' }, { merge: true });
      } catch (e) {
        console.error("Failed to set status to offline:", e);
      }
    }
    localStorage.removeItem('chatstudio_uid');
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Firebase signOut failed:", e);
    }
    setUserId(null);
    setCurrentUser(null);
    setSelectedUserId(null);
    window.location.hash = '#/';
  };

  const selectedUser = users.find(u => u.uid === selectedUserId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f19] font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-semibold tracking-wide">ChatStudio yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Auth
  if (!userId || !currentUser) {
    return <Auth onAuthSuccess={(uid) => setUserId(uid)} />;
  }

  return (
    <div className="h-screen h-[100dvh] bg-[#070b13] text-slate-200 flex flex-col md:flex-row font-sans overflow-hidden select-none">
      
      {/* 1. SIDEBAR Navigation Panel */}
      <div className={`w-full md:w-80 bg-slate-900/60 border-b md:border-b-0 md:border-r border-slate-800/80 flex flex-col flex-shrink-0 relative z-20 ${(selectedUserId && activeTab === 'chat') || activeTab !== 'chat' ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-white text-md tracking-tight">ChatStudio</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile menu trigger */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Current user mini profile ribbon */}
        <div className="p-4 bg-slate-950/20 border-b border-slate-800/40 flex items-center justify-between">
          <div 
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => setProfileModalUser(currentUser)}
          >
            <div className="relative">
              <img 
                src={currentUser.photoURL} 
                alt="My profile" 
                className="w-9 h-9 rounded-full bg-slate-950 border border-slate-800 object-cover"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-slate-900 bg-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 truncate max-w-[120px] transition-colors">
                {currentUser.displayName}
              </p>
              <p className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">@{currentUser.username}</p>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="p-1.5 bg-slate-950/40 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-800/60 cursor-pointer transition-all"
            title="Güvenli Çıkış"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Actions Menu */}
        <div className={`p-2 space-y-1 ${mobileMenuOpen ? 'block' : 'hidden md:block'} border-b border-slate-800/40`}>
          <button
            onClick={() => changeTab('chat')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'chat' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span>Sohbetler</span>
            </div>
            {activeTab !== 'chat' && (
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
            )}
          </button>

          <button
            onClick={() => changeTab('settings')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'settings' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Profil Ayarları</span>
          </button>
        </div>

        {/* Real-time users list (Only displayed when 'chat' tab is active) */}
        {activeTab === 'chat' && (
          <div className="flex-1 overflow-hidden">
            <UserList 
              users={users}
              currentUserId={currentUser.uid}
              selectedUserId={selectedUserId}
              onSelectUser={(uid) => {
                setSelectedUserId(uid);
                setMobileMenuOpen(false);
              }}
              onOpenProfile={(user) => setProfileModalUser(user)}
            />
          </div>
        )}
      </div>

      {/* 2. MAIN Content Display Area */}
      <div className={`flex-1 flex flex-col min-w-0 relative z-10 ${!selectedUserId && activeTab === 'chat' ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Dynamic Route views switch */}
        <div className={`flex-1 flex flex-col min-h-0 ${activeTab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {activeTab === 'chat' ? (
            selectedUser ? (
              // Chat conversation active
              <div className="flex-1 flex flex-col min-h-0">
                <ChatArea 
                  currentUser={currentUser}
                  selectedUser={selectedUser}
                  onBack={() => setSelectedUserId(null)}
                  onOpenProfile={(user) => setProfileModalUser(user)}
                />
              </div>
            ) : (
              // Empty selection screen (Desktop default)
              <div className={`hidden md:flex flex-col items-center justify-center h-full text-center p-8 bg-slate-950/10`}>
                <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500/20 to-sky-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-4 border border-indigo-500/10 shadow-inner">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">ChatStudio'ya Hoş Geldiniz!</h2>
                <p className="text-slate-400 text-sm max-w-sm mt-1.5 leading-relaxed">
                  Mesajlaşmaya başlamak için sol taraftaki kullanıcı listesinden birini seçin veya **Gemini AI ✦** asistanımızla hemen konuşun!
                </p>
              </div>
            )
          ) : activeTab === 'settings' ? (
            <div className="py-6 px-4 md:px-0">
              {/* Back to Chat header for mobile */}
              <div className="md:hidden mb-4 flex items-center">
                <button
                  onClick={() => changeTab('chat')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  ← Sohbetlere Geri Dön
                </button>
              </div>
              <ProfileSettings currentUser={currentUser} onProfileUpdate={() => {}} />
            </div>
          ) : activeTab === 'admin' ? (
            <div className="py-6 px-4 md:px-0">
              {/* Back to Chat header for mobile */}
              <div className="md:hidden mb-4 flex items-center">
                <button
                  onClick={() => changeTab('chat')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  ← Sohbetlere Geri Dön
                </button>
              </div>
              <AdminPanel currentUser={currentUser} />
            </div>
          ) : null}
        </div>
      </div>

      {/* 3. PROFILE DETAILS MODAL (Pop-up overlay) */}
      {profileModalUser && (
        <ProfileCard 
          user={profileModalUser}
          currentUser={currentUser}
          onClose={() => setProfileModalUser(null)}
          onProfileUpdate={() => {}}
        />
      )}
    </div>
  );
}
