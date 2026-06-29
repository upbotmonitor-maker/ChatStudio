export interface UserProfile {
  uid: string;
  username: string; // unique lowercase identifier
  displayName: string;
  email: string;
  photoURL: string;
  bio: string;
  status: 'online' | 'offline';
  lastSeen?: any; // Firestore Timestamp or Date of last activity
  createdAt: any; // Firestore Timestamp
  role: 'admin' | 'user';
  isBanned: boolean;
  coins: number;
  gifEnabled: boolean;
  gifUrl: string;
  gifStartTime: any; // Firestore Timestamp or null
  gifExpireTime: any; // Firestore Timestamp or null
}

export interface Message {
  id: string;
  chatId: string; // e.g., "uid1_uid2" (sorted alphabetically)
  senderId: string;
  receiverId: string;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  createdAt: any; // Firestore Timestamp
}

export interface AppStats {
  totalUsers: number;
  totalMessages: number;
  activeOnline: number;
}
