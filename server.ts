import express from 'express';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Initialize lazy loading of GoogleGenAI client so it doesn't crash if key is missing during build or startup
let aiClient: GoogleGenAI | null = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined on the server.');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Setup multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

app.use(express.json());

// API: Server health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API: Call Gemini AI
app.post('/api/chat', async (req, res) => {
  try {
    const { history, message } = req.body;
    
    // Check if API key is defined
    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        success: false,
        error: 'NO_API_KEY',
        fallbackResponse: `Merhaba! Ben **Gemini AI** ✦\n\nSistemde henüz **GEMINI_API_KEY** (Gemini API Anahtarı) tanımlanmadığı için sizinle canlı konuşamıyorum. Lütfen Google AI Studio ayarlarından API anahtarını tanımlayın.\n\nAncak yine de yerel olarak size yardımcı olabilirim! ChatStudio altyapısı **React**, **Tailwind CSS** ve **Firebase Firestore** teknolojileriyle geliştirilmiştir.`
      });
    }

    const client = getAiClient();
    
    // Format messages for Gemini API
    const contents: any[] = [];
    
    // Add history
    if (Array.isArray(history)) {
      // Limit history to the last 15 messages to stay within prompt token bounds and keep it fast
      const recentHistory = history.slice(-15);
      recentHistory.forEach((msg: any) => {
        const role = msg.senderId === 'chatstudio_ai' ? 'model' : 'user';
        contents.push({
          role,
          parts: [{ text: msg.text }]
        });
      });
    }
    
    // Add current message if not present
    if (message && (!contents.length || contents[contents.length - 1].parts[0].text !== message)) {
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });
    }

    if (contents.length === 0) {
      return res.status(400).json({ success: false, error: 'Mesaj içeriği boş olamaz.' });
    }

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: "Sen ChatStudio platformunda bulunan 'Gemini AI' (eski adıyla ChatStudio AI) isimli, cana yakın, son derece profesyonel ve teknik açıdan bilgili bir yapay zeka asistanısın. Kullanıcı ile samimi, akıllı, net ve tamamen Türkçe dilinde konuşmalısın. Cevaplarında Türkçe dışındaki dilleri (örneğin İngilizce) asla varsayılan olarak kullanma, her zaman doğal ve akıcı bir Türkçe tercih et. Önemli vurguları ve kelimeleri markdown kalınlaştırma biçimi (örn. **kelime**) ile yaz. Kullanıcılara teknik sorularında yardımcı ol, sohbet et, yönlendirici ve sıcakkanlı ol.",
      }
    });

    const replyText = response.text || "Üzgünüm, şu an yanıt üretemiyorum.";
    
    return res.json({
      success: true,
      text: replyText
    });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Yapay zeka yanıtı üretilirken bir hata oluştu.'
    });
  }
});

// API: Proxy file upload to ImgBB securely
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      console.error('IMGBB_API_KEY environment variable is not defined on the server.');
      return res.status(500).json({
        success: false,
        error: 'Sistem hatası: ImgBB API anahtarı sunucuda tanımlanmamış. Lütfen yöneticiye başvurun.',
      });
    }

    // Convert file buffer to base64
    const base64Image = req.file.buffer.toString('base64');

    // Create Form Data to send to ImgBB
    const formData = new FormData();
    formData.append('image', base64Image);

    const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });

    const result = await imgbbResponse.json();

    if (result.success) {
      return res.json({
        success: true,
        data: {
          url: result.data.url,
          display_url: result.data.display_url,
          title: result.data.title,
        },
      });
    } else {
      console.error('ImgBB upload error:', result.error);
      return res.status(400).json({
        success: false,
        error: result.error?.message || 'ImgBB yüklemesi başarısız oldu.',
      });
    }
  } catch (error: any) {
    console.error('Upload proxy error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Görsel yüklenirken bir sunucu hatası oluştu.',
    });
  }
});

// API: Save recorded voice message
app.post('/api/upload-audio', upload.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya yüklenemedi.' });
    }
    const filename = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, req.file.buffer);
    return res.json({
      success: true,
      url: `/uploads/${filename}`
    });
  } catch (err: any) {
    console.error("Audio save error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

async function startServer() {
  // Vite middleware setup for Development vs Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer();
