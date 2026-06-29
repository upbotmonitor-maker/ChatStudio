import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  doc,
  setDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, ArrowLeft, User, Sparkles, Smile, Paperclip, 
  Mic, Trash2, Play, Pause, Volume2 
} from 'lucide-react';
import { UserProfile, Message } from '../types';
import { GeminiAvatar } from './GeminiAvatar';
import { GeminiWritingLoader } from './GeminiWritingLoader';

interface ChatAreaProps {
  currentUser: UserProfile;
  selectedUser: UserProfile;
  onBack: () => void;
  onOpenProfile: (user: UserProfile) => void;
}

// Helper to format last activity timestamp
export function formatLastSeen(lastSeen: any) {
  if (!lastSeen) return '';
  const date = lastSeen.seconds ? new Date(lastSeen.seconds * 1000) : new Date(lastSeen);
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  
  if (diffMins < 1) return 'az önce';
  if (diffMins < 60) return `${diffMins} dk önce`;
  if (diffHours < 24) return `${diffHours} sa önce`;
  
  return date.toLocaleDateString('tr-TR', { 
    day: 'numeric', 
    month: 'short', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

const POPULAR_EMOJIS = ['😊', '😂', '❤️', '👍', '🔥', '😍', '🎉', '🚀', '🤔', '👏', '😭', '😮', '🌟', '✦', '👌', '👀'];

export default function ChatArea({ 
  currentUser, 
  selectedUser, 
  onBack, 
  onOpenProfile 
}: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Realtime typing indicators state
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserIsTyping, setOtherUserIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // UI States
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAi = selectedUser.uid === 'chatstudio_ai';
  const chatId = [currentUser.uid, selectedUser.uid].sort().join('_');

  // Load and subscribe to messages
  useEffect(() => {
    const messagesRef = collection(db, 'messages');
    const q = query(messagesRef, where('chatId', '==', chatId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        msgList.push({
          id: doc.id,
          chatId: data.chatId,
          senderId: data.senderId,
          receiverId: data.receiverId,
          text: data.text,
          imageUrl: data.imageUrl,
          audioUrl: data.audioUrl,
          createdAt: data.createdAt
        });
      });

      // Client-side sort to avoid index build delay
      msgList.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeA - timeB;
      });

      setMessages(msgList);
    }, (error) => {
      console.error("Messages snapshot error:", error);
    });

    return () => unsubscribe();
  }, [chatId]);

  // Synchronize typing status in Firestore
  const setTypingInDb = async (typingValue: boolean) => {
    if (isAi) return;
    try {
      const docRef = doc(db, 'typing', `${chatId}_${currentUser.uid}`);
      await setDoc(docRef, {
        isTyping: typingValue,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error("Error setting typing status:", e);
    }
  };

  // Debounced input typing handler
  const handleInputChange = (text: string) => {
    setInputText(text);
    if (!isTyping) {
      setIsTyping(true);
      setTypingInDb(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTypingInDb(false);
    }, 3000);
  };

  // Listen to other user's typing status
  useEffect(() => {
    if (isAi) {
      setOtherUserIsTyping(isAiThinking);
      return;
    }

    const docRef = doc(db, 'typing', `${chatId}_${selectedUser.uid}`);
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const isTypingActive = data.isTyping && (new Date().getTime() - new Date(data.updatedAt).getTime() < 8000);
        setOtherUserIsTyping(isTypingActive);
      } else {
        setOtherUserIsTyping(false);
      }
    });

    return () => {
      unsubscribe();
      // Reset current user's typing state on unmount or recipient switch
      setTypingInDb(false);
    };
  }, [chatId, selectedUser.uid, isAi, isAiThinking]);

  // Scroll to bottom whenever messages or thinking state changes
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages, isAiThinking, otherUserIsTyping]);

  // Handle standard message submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const messageText = inputText.trim();
    setInputText('');
    setIsSending(true);
    setTypingInDb(false);

    try {
      // 1. Save user message to Firestore
      const messagesRef = collection(db, 'messages');
      await addDoc(messagesRef, {
        chatId,
        senderId: currentUser.uid,
        receiverId: selectedUser.uid,
        text: messageText,
        createdAt: serverTimestamp() || new Date()
      });

      // 2. AI Response simulation
      if (isAi) {
        await triggerAiResponse(messageText);
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  // Handle image upload through our secure secure proxy API
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSending(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const resData = await response.json();
      if (resData.success) {
        const imageUrl = resData.data.url;
        
        // Save image message to Firestore
        const messagesRef = collection(db, 'messages');
        await addDoc(messagesRef, {
          chatId,
          senderId: currentUser.uid,
          receiverId: selectedUser.uid,
          text: '📷 Görsel',
          imageUrl: imageUrl,
          createdAt: serverTimestamp() || new Date()
        });

        // Trigger AI reply if user is talking with AI
        if (isAi) {
          await triggerAiResponse("Kullanıcı bir görsel gönderdi.");
        }
      } else {
        alert("Görsel yüklenemedi: " + resData.error);
      }
    } catch (err) {
      console.error("Image upload failed:", err);
      alert("Görsel yüklenirken bir hata oluştu.");
    } finally {
      setIsSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Push-to-Talk record start (Supports mouse + mobile touch)
  const startRecording = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    audioChunksRef.current = [];
    setRecordDuration(0);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Auto-upload and send the voice note
        await uploadAndSendAudio(audioBlob);
        
        // Release mic stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone access failed:", err);
      alert("Mikrofona erişilemedi. Lütfen mikrofon izinlerini kontrol edin.");
    }
  };

  // Push-to-Talk record stop (Supports mouse + touch release)
  const stopRecording = (e: React.MouseEvent | React.TouchEvent | React.SyntheticEvent) => {
    e.preventDefault();
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Upload recorded audio to express container public/uploads statically
  const uploadAndSendAudio = async (blob: Blob) => {
    setIsSending(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      
      const response = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData
      });
      
      const resData = await response.json();
      if (resData.success) {
        // Send audio message to Firestore
        const messagesRef = collection(db, 'messages');
        await addDoc(messagesRef, {
          chatId,
          senderId: currentUser.uid,
          receiverId: selectedUser.uid,
          text: '🎤 Sesli Mesaj',
          audioUrl: resData.url,
          createdAt: serverTimestamp() || new Date()
        });

        // Trigger AI response if chatting with Gemini
        if (isAi) {
          await triggerAiResponse("Kullanıcı bir ses kaydı gönderdi.");
        }
      } else {
        alert("Ses kaydı yüklenemedi: " + resData.error);
      }
    } catch (err) {
      console.error("Audio upload failed:", err);
      alert("Ses kaydı yüklenirken bir hata oluştu.");
    } finally {
      setIsSending(false);
    }
  };

  // Send content to Gemini AI proxy endpoint
  const triggerAiResponse = async (userPrompt: string) => {
    setIsAiThinking(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userPrompt,
          history: [
            ...messages.map(m => ({ senderId: m.senderId, text: m.text })),
            { senderId: currentUser.uid, text: userPrompt }
          ]
        })
      });

      const result = await response.json();
      let finalResponse = '';

      if (result.success && result.text) {
        finalResponse = result.text;
      } else if (result.error === 'NO_API_KEY' && result.fallbackResponse) {
        finalResponse = result.fallbackResponse;
      } else {
        finalResponse = generateAiFallbackResponse(userPrompt, currentUser.displayName);
      }

      // Output typing animations sequentially per paragraph
      const chunks = finalResponse.split('\n\n');
      const messagesRef = collection(db, 'messages');
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk.trim()) continue;

        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }

        await addDoc(messagesRef, {
          chatId,
          senderId: 'chatstudio_ai',
          receiverId: currentUser.uid,
          text: chunk.trim(),
          createdAt: serverTimestamp() || new Date()
        });
      }
    } catch (apiErr) {
      console.error("AI API Call failed, fallback to offline rules:", apiErr);
      const fallbackMsg = generateAiFallbackResponse(userPrompt, currentUser.displayName);
      const messagesRef = collection(db, 'messages');
      await addDoc(messagesRef, {
        chatId,
        senderId: 'chatstudio_ai',
        receiverId: currentUser.uid,
        text: fallbackMsg,
        createdAt: serverTimestamp() || new Date()
      });
    } finally {
      setIsAiThinking(false);
    }
  };

  // Local rule-based offline backup generator
  const generateAiFallbackResponse = (userInput: string, userName: string): string => {
    const input = userInput.toLowerCase();
    if (input.includes('merhaba') || input.includes('selam') || input.includes('süleyman') || input.includes('hey')) {
      return `Merhaba **${userName}**! Ben **Gemini AI** ✦\n\nSize teknik, operasyonel veya genel tüm konularda rehberlik etmek için sabırsızlanıyorum.`;
    }
    if (input.includes('nasılsın') || input.includes('nasıl gidiyor')) {
      return `Teşekkür ederim **${userName}**, harikayım! Tüm veritabanı akışını ve sistem optimizasyonlarını gerçek zamanlı takip ediyorum. Siz nasılsınız?`;
    }
    if (input.includes('ses') || input.includes('kayıt')) {
      return `Gönderdiğiniz **sesli mesajı** başarıyla aldım! Mikrofon kaliteniz harika, ses dalgaları kararlı görünüyor. Size sesli asistan desteğiyle yardımcı olmaktan mutluluk duyarım.`;
    }
    if (input.includes('görsel') || input.includes('fotoğraf') || input.includes('resim')) {
      return `Gönderdiğiniz **görseli** başarıyla aldım! Piksel derinliği ve renk verileri mükemmel optimize edilmiş durumda.`;
    }
    return `Anlıyorum **${userName}**. ChatStudio üzerinde her zaman en akıcı ve güvenilir iletişim ortamını sunmak için çalışıyoruz. Başka bir sorunuz var mı?`;
  };

  // Helper to get local message time string
  const formatMsgTime = (createdAt: any) => {
    if (!createdAt) return '';
    const date = createdAt.seconds 
      ? new Date(createdAt.seconds * 1000) 
      : new Date(createdAt);
    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format bold styling (**bold**) inside chat bubble
  const renderMessageText = (text: string) => {
    if (!text) return '';
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-extrabold text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Format recording timer
  const formatRecordTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/20 relative">
      {/* 1. Active Chat Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* User Profile Trigger Info */}
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => onOpenProfile(selectedUser)}
          >
            <div className="relative">
              {isAi ? (
                <GeminiAvatar size="md" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                  <img 
                    src={selectedUser.photoURL} 
                    alt={selectedUser.displayName} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                isAi || selectedUser.status === 'online' ? 'bg-emerald-500' : 'bg-slate-500'
              }`} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                {selectedUser.displayName}
                {isAi && (
                  <span className="text-indigo-400 font-bold text-md select-none">
                    ✦
                  </span>
                )}
              </h3>
              
              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 h-4">
                {otherUserIsTyping ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                    yazıyor
                    <span className="inline-block animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                    <span className="inline-block animate-bounce" style={{ animationDelay: '200ms' }}>.</span>
                    <span className="inline-block animate-bounce" style={{ animationDelay: '400ms' }}>.</span>
                  </span>
                ) : (
                  <>
                    <span>@{selectedUser.username}</span>
                    <span className="text-slate-600">•</span>
                    {isAi || selectedUser.status === 'online' ? (
                      <span className="text-emerald-400 font-medium">çevrimiçi</span>
                    ) : (
                      <span className="text-slate-500">
                        {selectedUser.lastSeen ? `son görülme ${formatLastSeen(selectedUser.lastSeen)}` : 'çevrimdışı'}
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => onOpenProfile(selectedUser)}
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 bg-indigo-500/5 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
        >
          Profili İncele
        </button>
      </div>

      {/* 2. Messages List Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length > 0 ? (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser.uid;
            return (
              <div 
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] rounded-2xl p-3.5 shadow-md relative group ${
                  isMe 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-slate-900/80 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}>
                  {/* Optional Image */}
                  {msg.imageUrl && (
                    <div className="mb-2 max-w-full rounded-xl overflow-hidden border border-slate-950/60 bg-slate-950/40 cursor-pointer">
                      <img 
                        src={msg.imageUrl} 
                        alt="Görsel" 
                        className="max-h-64 object-contain w-full hover:scale-[1.01] transition-transform duration-200"
                        onClick={() => window.open(msg.imageUrl, '_blank')}
                      />
                    </div>
                  )}

                  {/* Optional Voice Note Player */}
                  {msg.audioUrl && (
                    <div className="mb-2 p-1 bg-slate-950/50 rounded-xl border border-slate-800/60 flex items-center">
                      <audio 
                        src={msg.audioUrl} 
                        controls 
                        className="w-full max-w-xs h-9 text-xs filter invert outline-none accent-indigo-500" 
                      />
                    </div>
                  )}

                  {/* Message Text */}
                  {msg.text && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap select-text">
                      {renderMessageText(msg.text)}
                    </p>
                  )}

                  <div className={`text-[9px] mt-1.5 font-mono text-right ${
                    isMe ? 'text-indigo-200' : 'text-slate-400'
                  }`}>
                    {formatMsgTime(msg.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 mb-3 border border-indigo-500/10">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <p className="text-slate-400 text-sm font-semibold">Sohbetin Başlangıcı</p>
            <p className="text-slate-500 text-xs mt-1">İlk mesajı göndererek sohbete hemen başlayın.</p>
          </div>
        )}

        {/* Typing and Thinking Animations */}
        <AnimatePresence>
          {isAiThinking ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex justify-start w-full"
            >
              <GeminiWritingLoader />
            </motion.div>
          ) : otherUserIsTyping ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex justify-start"
            >
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl rounded-tl-none p-3.5 flex items-center gap-3">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  {selectedUser.displayName} yazıyor
                  <span className="flex items-center gap-0.5">
                    <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Input Footer Control Area */}
      <div className="p-4 bg-slate-900/40 border-t border-slate-800/80 flex flex-col gap-2 relative">
        {/* Emoji Selector Card */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-20 left-4 bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-2xl z-30 max-w-xs grid grid-cols-6 gap-2"
            >
              {POPULAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    handleInputChange(inputText + emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden inputs */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          onChange={handleImageSelect} 
          className="hidden" 
        />

        {/* Dynamic Voice Recording Display Overlay */}
        {isRecording ? (
          <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl px-4 py-3 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3 text-rose-400 text-xs font-semibold">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
              <span>SES KAYDEDİLİYOR... {formatRecordTime(recordDuration)}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium font-mono">Bırakınca Gönderilir</span>
          </div>
        ) : null}

        <form 
          onSubmit={handleSendMessage}
          className="flex items-center gap-2"
        >
          {/* Attachment Selector Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || isRecording}
            className="p-3 bg-slate-950/40 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer disabled:opacity-40"
            title="Görsel Gönder"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Emoji Toggle */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={isSending || isRecording}
            className="p-3 bg-slate-950/40 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer disabled:opacity-40"
            title="Emoji Ekle"
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Text input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={isSending || isRecording}
            placeholder={isSending ? "Gönderiliyor..." : "Bir mesaj yazın..."}
            className="flex-1 bg-slate-950/60 border border-slate-800/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 text-sm transition-all outline-none disabled:opacity-50"
          />

          {/* Push to talk Microphone Button (Hold to Record, Release to Send) */}
          <button
            type="button"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={isSending || !!inputText.trim()}
            className={`p-3 border rounded-xl transition-all cursor-grab active:cursor-grabbing disabled:opacity-30 disabled:cursor-not-allowed ${
              isRecording 
                ? 'bg-rose-600 border-rose-500 text-white animate-pulse' 
                : 'bg-slate-950/40 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Konuşmak için basılı tutun, bırakınca gönderilir"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Send Message Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isSending || isRecording}
            className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/10 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
