import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import morgan from 'morgan';
import connectDB from './config/dbConnect';
import mongoose from 'mongoose';

// Routes
import userRoutes from './routes/userRoutes';
import challengeRoutes from './routes/challengeRoutes';
import userChallengeRoutes from './routes/userchallengeRoutes';
import badgeRoutes from './routes/badgeRoutes';
import messageRoutes from './routes/messageRoutes';

const app = express();
const httpServer = createServer(app); // Express 앱을 HTTP 서버로 감싸기
const PORT = process.env.PORT || 8080;

// Socket.IO 설정
const io = new Server(httpServer, {
  cors: {
    origin: "*", // 개발용 - 실제 배포시에는 특정 도메인으로 제한
    methods: ["GET", "POST"]
  }
});

connectDB(); // MongoDB 연결

// Middleware
app.use(express.json());
app.use(morgan('combined'));
app.use(cors()); // CORS 추가

// 정적 파일 서빙 (uploads 폴더)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'JoinUP Server is running!' 
  });
});

// API Routes
app.use('/api/auth', userRoutes);
app.use('/api/challenge', challengeRoutes);
app.use('/api/userchallenge', userChallengeRoutes);
app.use('/api/badge', badgeRoutes);
app.use('/api/message', messageRoutes); // 메시지 라우트 추가

// Socket.IO 이벤트 처리
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 챌린지 방 참가
  socket.on('join_challenge', (challengeId: string) => {
    socket.join(`challenge_${challengeId}`);
    console.log(`User ${socket.id} joined challenge ${challengeId}`);
  });

  // 챌린지 방 떠나기
  socket.on('leave_challenge', (challengeId: string) => {
    socket.leave(`challenge_${challengeId}`);
    console.log(`User ${socket.id} left challenge ${challengeId}`);
  });

  // 채팅 메시지 전송
  socket.on('send_message', async (data: {
    challengeId: string;
    message: string;
    userId: string;
    userNickname: string;
    userProfileImage?: string;
    timestamp: string;
  }) => {
    try {
      // 메시지를 DB에 저장 (선택사항)
      // await saveMessage({
      //   challengeId: data.challengeId,
      //   userId: data.userId,
      //   message: data.message
      // });

      // 같은 챌린지 방의 모든 사용자에게 메시지 전송
      io.to(`challenge_${data.challengeId}`).emit('receive_message', {
        id: Date.now().toString(), // 임시 ID
        message: data.message,
        userId: data.userId,
        userNickname: data.userNickname,
        userProfileImage: data.userProfileImage,
        timestamp: data.timestamp,
        challengeId: data.challengeId,
      });

      console.log(`Message sent to challenge ${data.challengeId}:`, data.message);
    } catch (error) {
      console.error('Error handling message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // 사용자 연결 해제
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

// MongoDB 연결 및 서버 시작
mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB');
  // app.listen 대신 httpServer.listen 사용
  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO server is ready`);
  });
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

export default app;
export { io }; // Socket.IO 인스턴스를 다른 파일에서 사용할 수 있도록 export