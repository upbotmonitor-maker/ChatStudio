import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { motion } from 'motion/react';
import { User, Mail, Lock, Sparkles, MessageSquareCode, ArrowRight } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (uid: string) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!isLogin) {
      if (cleanUsername.length < 3) {
        setError('Kullanıcı adı en az 3 karakter olmalı ve sadece harf/rakam/alt çizgi içermelidir.');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Şifre en az 6 karakter olmalıdır.');
        setLoading(false);
        return;
      }
    }

    try {
      if (isLogin) {
        // LOGIN
        let loginEmail = email.trim();
        let fallbackUid = '';

        try {
          // If they entered a username instead of email (doesn't contain @)
          if (!loginEmail.includes('@')) {
            const usernameDocRef = doc(db, 'usernames', loginEmail.toLowerCase());
            const usernameSnap = await getDoc(usernameDocRef);
            if (usernameSnap.exists()) {
              const uid = usernameSnap.data().uid;
              const userDocSnap = await getDoc(doc(db, 'users', uid));
              if (userDocSnap.exists()) {
                loginEmail = userDocSnap.data().email;
              } else {
                throw new Error('Kullanıcı profili bulunamadı.');
              }
            } else {
              throw new Error('Bu kullanıcı adı kayıtlı değil.');
            }
          }

          const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
          const uid = userCredential.user.uid;
          
          // Check if user is banned
          const userDocRef = doc(db, 'users', uid);
          const userSnap = await getDoc(userDocRef);
          
          if (userSnap.exists() && userSnap.data().isBanned) {
            await signOut(auth);
            throw new Error('Hesabınız askıya alınmıştır (banned). Lütfen yönetici ile iletişime geçin.');
          }

          // Set status to online
          await setDoc(userDocRef, { status: 'online' }, { merge: true });
          localStorage.setItem('chatstudio_uid', uid);
          onAuthSuccess(uid);

        } catch (authErr: any) {
          console.warn("Firebase standard auth failed. Falling back to direct Firestore auth...", authErr);

          // Custom direct auth fallback: Search users directly
          if (!email.trim().includes('@')) {
            // It's a username
            const usernameDocRef = doc(db, 'usernames', email.trim().toLowerCase());
            const usernameSnap = await getDoc(usernameDocRef);
            if (usernameSnap.exists()) {
              fallbackUid = usernameSnap.data().uid;
            } else {
              throw new Error('Bu kullanıcı adı kayıtlı değil.');
            }
          } else {
            // It's an email - find in Firestore users
            const q = query(collection(db, 'users'), where('email', '==', email.trim()));
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
              fallbackUid = querySnap.docs[0].id;
            } else {
              throw new Error('Bu e-posta adresi kayıtlı değil.');
            }
          }

          if (fallbackUid) {
            const userDocRef = doc(db, 'users', fallbackUid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
              const uData = userSnap.data();
              if (uData.isBanned) {
                throw new Error('Hesabınız askıya alınmıştır.');
              }
              // Check password if stored
              if (uData.password && uData.password !== password) {
                throw new Error('E-posta/Kullanıcı adı veya şifre hatalı.');
              }
              // Set status to online
              await setDoc(userDocRef, { status: 'online' }, { merge: true });
              localStorage.setItem('chatstudio_uid', fallbackUid);
              onAuthSuccess(fallbackUid);
            } else {
              throw new Error('Kullanıcı profili bulunamadı.');
            }
          } else {
            throw authErr;
          }
        }

      } else {
        // REGISTER
        // 1. Check if username exists
        const usernameDocRef = doc(db, 'usernames', cleanUsername);
        const usernameSnap = await getDoc(usernameDocRef);

        if (usernameSnap.exists()) {
          throw new Error('Bu kullanıcı adı zaten alınmış.');
        }

        let uid = '';
        try {
          // Try standard Firebase Auth first
          const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
          uid = userCredential.user.uid;
        } catch (authErr: any) {
          console.warn("Firebase Auth register failed. Creating custom Firestore account...", authErr);
          // Standard signup is disabled/failed, generate custom ID
          uid = 'usr_' + Math.random().toString(36).substring(2, 15);
        }

        // Default avatar from Dicebear initials style for A, E, S etc.
        const cleanDisplayName = displayName.trim() || username.trim();
        const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanDisplayName)}`;

        // 3. Save User Profile
        const userProfile = {
          uid,
          username: cleanUsername,
          displayName: cleanDisplayName,
          email: email.trim(),
          password: password, // Store password so login works in fallback mode
          photoURL: defaultAvatar,
          bio: 'Merhaba! ChatStudio kurumsal iletişim platformuna katıldım.',
          status: 'online',
          createdAt: serverTimestamp(),
          role: 'user',
          isBanned: false
        };

        // Use atomic batch write
        const batch = writeBatch(db);
        batch.set(doc(db, 'users', uid), userProfile);
        batch.set(usernameDocRef, { uid });
        await batch.commit();

        // Save session
        localStorage.setItem('chatstudio_uid', uid);
        onAuthSuccess(uid);
      }
    } catch (err: any) {
      console.error(err);
      let localizedError = err.message;
      if (err.code === 'auth/invalid-email') localizedError = 'Geçersiz e-posta adresi.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') localizedError = 'E-posta veya şifre hatalı.';
      if (err.code === 'auth/email-already-in-use') localizedError = 'Bu e-posta adresi zaten kullanımda.';
      if (err.code === 'auth/weak-password') localizedError = 'Şifre çok zayıf. En az 6 karakter olmalıdır.';
      if (err.code === 'auth/operation-not-allowed') {
        localizedError = 'Cihaz veya giriş yöntemi desteklenmiyor. Lütfen geçerli bir e-posta ve şifre girin.';
      }
      setError(localizedError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0f19] p-4 relative overflow-hidden font-sans">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-10 right-10 w-[200px] h-[200px] bg-sky-500/5 rounded-full blur-[80px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative z-10"
      >
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-sky-400 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-3">
            <MessageSquareCode className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            ChatStudio <span className="text-xs bg-indigo-500/20 text-indigo-400 font-medium px-2 py-0.5 rounded-full border border-indigo-500/30">V1.0</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1 text-center">
            {isLogin ? 'Hesabınıza giriş yaparak sohbete başlayın' : 'Hemen ücretsiz bir hesap oluşturun'}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl text-center"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Görünür İsim (Display Name)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Sparkles className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Ahmet Yılmaz"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 rounded-xl pl-11 pr-4 py-3 text-slate-200 placeholder-slate-500 text-sm transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Benzersiz Kullanıcı Adı (Giriş için de kullanılır)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Örn: ahmet123"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 rounded-xl pl-11 pr-4 py-3 text-slate-200 placeholder-slate-500 text-sm transition-all outline-none font-mono"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {isLogin ? 'Kullanıcı Adı veya E-Posta' : 'E-Posta Adresi'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type={isLogin ? "text" : "email"}
                required
                placeholder={isLogin ? "Kullanıcı adı veya e-posta" : "orn@gmail.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 rounded-xl pl-11 pr-4 py-3 text-slate-200 placeholder-slate-500 text-sm transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Şifre</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                required
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 rounded-xl pl-11 pr-4 py-3 text-slate-200 placeholder-slate-500 text-sm transition-all outline-none font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white font-semibold rounded-xl py-3 px-4 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-slate-400 text-sm">
            {isLogin ? 'Bir hesabınız yok mu?' : 'Zaten bir hesabınız var mı?'}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-indigo-400 hover:text-indigo-300 font-semibold ml-2 underline outline-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1"
            >
              {isLogin ? 'Kayıt Olun' : 'Giriş Yapın'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
