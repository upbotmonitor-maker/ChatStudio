import { useState } from 'react';
import { UserProfile } from '../types';
import { Search, User, Sparkles } from 'lucide-react';
import { GeminiAvatar } from './GeminiAvatar';
import { formatLastSeen } from './ChatArea';

interface UserListProps {
  users: UserProfile[];
  currentUserId: string;
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  onOpenProfile: (user: UserProfile) => void;
}

export default function UserList({ 
  users, 
  currentUserId, 
  selectedUserId, 
  onSelectUser, 
  onOpenProfile 
}: UserListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter out current user and match search query
  const filteredUsers = users.filter(user => {
    if (user.uid === currentUserId) return false;
    if (user.isBanned) return false; // Hide banned users
    
    const search = searchQuery.toLowerCase();
    return (
      user.displayName.toLowerCase().includes(search) ||
      user.username.toLowerCase().includes(search)
    );
  });

  return (
    <div className="flex flex-col h-full bg-slate-900/40 border-r border-slate-800/80">
      {/* Header Search Section */}
      <div className="p-4 border-b border-slate-800/80">
        <h2 className="text-lg font-bold text-white mb-3">Sohbetler</h2>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Kullanıcı ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/40 border border-slate-800/80 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/20 rounded-xl pl-9 pr-4 py-2 text-slate-200 placeholder-slate-500 text-sm transition-all outline-none"
          />
        </div>
      </div>

      {/* User Items List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => {
            const isSelected = selectedUserId === user.uid;
            return (
              <div
                key={user.uid}
                className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer group ${
                  isSelected 
                    ? 'bg-indigo-600/25 border border-indigo-500/30' 
                    : 'hover:bg-slate-800/40 border border-transparent'
                }`}
                onClick={() => onSelectUser(user.uid)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Profile Picture */}
                  <div className="relative flex-shrink-0">
                    {user.uid === 'chatstudio_ai' ? (
                      <GeminiAvatar size="md" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                        <img 
                          src={user.photoURL} 
                          alt={user.displayName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {/* Status Dot */}
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                      user.uid === 'chatstudio_ai' || user.status === 'online' ? 'bg-emerald-500' : 'bg-slate-500'
                    }`} />
                  </div>

                  {/* Name Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors">
                        {user.displayName}
                        {user.uid === 'chatstudio_ai' && (
                          <span className="text-indigo-400 font-bold ml-1 text-xs">
                            ✦
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400 font-mono truncate">@{user.username}</p>
                    <div className="text-[10px] mt-0.5">
                      {user.uid === 'chatstudio_ai' || user.status === 'online' ? (
                        <span className="text-emerald-400 font-medium">çevrimiçi</span>
                      ) : (
                        <span className="text-slate-500 font-medium">
                          {user.lastSeen ? `son görülme: ${formatLastSeen(user.lastSeen)}` : 'çevrimdışı'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Profile Card Trigger Icon */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProfile(user);
                  }}
                  className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                  title="Profili Gör"
                >
                  <User className="w-4 h-4" />
                </button>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <p className="text-slate-500 text-sm">Hiçbir kullanıcı bulunamadı.</p>
          </div>
        )}
      </div>
    </div>
  );
}
