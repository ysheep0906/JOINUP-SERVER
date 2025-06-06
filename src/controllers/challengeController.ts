import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Challenge } from '../models/Challenge';
import { UserChallenge } from '../models/UserChallenge';
import { AuthRequest } from '../middleware/authType';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// 챌린지 이미지 업로드 설정
const challengeImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/challenges');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `challenge_${uniqueSuffix}${ext}`);
  }
});

export const challengeImageUpload = multer({
  storage: challengeImageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB 제한
  }
});

export const getChallenges = async (req: Request, res: Response) => { 
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const sortBy = req.query.sortBy as string || 'createdAt'; // createdAt, viewCount, completionRate

    const query: any = {};
    if (search) {
      query.$text = { $search: search };
    }

    let sortQuery: any = {};
    switch (sortBy) {
      case 'viewCount':
        sortQuery = { viewCount: -1 };
        break;
      case 'completionRate':
        sortQuery = { completionRate: -1 };
        break;
      default:
        sortQuery = { createdAt: -1 };
    }

    const challenges = await Challenge.find(query)
      .populate('createdBy', 'nickname profileImage')
      .sort(sortQuery)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Challenge.countDocuments(query);

    res.json({
      success: true,
      data: {
        challenges,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};


export const getChallengeById = async (req: Request, res: Response) => { // 챌린지 상세 조회
  try {
    const challenge = await Challenge.findById(req.params.id)
      .populate('createdBy', 'nickname profileImage')
      .populate('participants.userId', 'nickname profileImage');

    if (!challenge) {
      return res.status(404).json({ 
        success: false, 
        message: 'Challenge not found' 
      });
    }

    res.json({
      success: true,
      data: { challenge }
    });
  } catch (error) {
    console.error('Get challenge error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const createChallenge = async (req: AuthRequest, res: Response) => { // 챌린지 생성
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    // 이미지 업로드가 있는 경우 URL 설정
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/challenges/${req.file.filename}`;
    }

    const challengeData = {
      ...req.body,
      image: imageUrl, // 이미지 URL 추가
      createdBy: req.user?.id
    };

    const challenge = new Challenge(challengeData);
    await challenge.save();

    await challenge.populate('createdBy', 'nickname profileImage');

    res.status(201).json({
      success: true,
      data: { challenge }
    });
  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const joinChallenge = async (req: AuthRequest, res: Response) => { // 챌린지 참여
  try {
    const challengeId = req.params.id;
    const userId = req.user?.id;

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ 
        success: false, 
        message: 'Challenge not found' 
      });
    }

    // 이미 참여했는지 확인
    const isAlreadyJoined = challenge.participants.some(
      participant => participant.userId.toString() === userId
    );

    if (isAlreadyJoined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Already joined this challenge' 
      });
    }

    // 최대 참여자 수 확인
    if (challenge.participants.length >= challenge.maxParticipants) {
      return res.status(400).json({ 
        success: false, 
        message: 'Challenge is full' 
      });
    }

    // UserChallenge 생성
    const userChallenge = new UserChallenge({
      userId,
      challengeId,
      startDate: new Date()
    });
    await userChallenge.save();

    // 챌린지에 참여자 추가
    challenge.participants.push({ 
      userId: new mongoose.Types.ObjectId(userId!),
      joinedAt: new Date()
    });
    
    // userInfo에 UserChallenge ID 추가
    challenge.userInfo.push(userChallenge._id as mongoose.Types.ObjectId);
    
    await challenge.save();

    // 달성률 업데이트 (새로운 참여자로 인한 변경)
    await updateCompletionRate(challengeId);

    res.json({
      success: true,
      message: 'Successfully joined challenge',
      data: {
        userChallengeId: userChallenge._id
      }
    });
  } catch (error) {
    console.error('Join challenge error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

const completionPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/completions');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `completion_${uniqueSuffix}${ext}`);
  }
});

export const completionPhotoUpload = multer({
  storage: completionPhotoStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  }
});

export const completeChallenge = async (req: AuthRequest, res: Response) => { // 챌린지 완료
  try {
    const challengeId = req.params.id;
    const userId = req.user?.id;

    // 이미지 파일이 있는지 확인
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '완료 인증 사진이 필요합니다.'
      });
    }

    const userChallenge = await UserChallenge.findOne({ 
      userId, 
      challengeId 
    });

    if (!userChallenge) {
      // 업로드된 파일 삭제
      if (req.file) {
        const filePath = req.file.path;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(404).json({ 
        success: false, 
        message: 'User challenge not found' 
      });
    }

    // UTC 기준으로 오늘 날짜 생성 (시간을 00:00으로 설정) 
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    console.log('Today date (UTC 00:00):', today);

    // 오늘 이미 완료했는지 확인
    const alreadyCompleted = userChallenge.completedDates.some(date => {
      const completedDate = new Date(date);
      return completedDate.getTime() === today.getTime();
    });

    if (alreadyCompleted) {
      // 업로드된 파일 삭제
      if (req.file) {
        const filePath = req.file.path;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(400).json({ 
        success: false, 
        message: '이미 오늘 완료했습니다.' 
      });
    }

    // 완료 사진 URL 생성
    const photoUrl = `/uploads/completions/${req.file.filename}`;

    // 완료일 추가 및 통계 업데이트
    userChallenge.completedDates.push(today);
    userChallenge.completionPhotos.push({
      date: today,
      photoUrl: photoUrl
    });
    userChallenge.totalCompletions += 1;
    userChallenge.score += 10;
    userChallenge.lastCompletionDate = today;

    // 연속 달성일 계산 (UTC 기준)
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    
    const completedYesterday = userChallenge.completedDates.some(date => {
      const completedDate = new Date(date);
      return completedDate.getTime() === yesterday.getTime();
    });

    if (completedYesterday) {
      userChallenge.currentStreakCount += 1;
    } else {
      userChallenge.currentStreakCount = 1;
    }

    if (userChallenge.currentStreakCount > userChallenge.maxStreakCount) {
      userChallenge.maxStreakCount = userChallenge.currentStreakCount;
    }

    await userChallenge.save();

    // 변수 초기화를 상위 스코프로 이동
    let trustScoreIncrease = 0;

    // 유저 신뢰도 증가 및 배지 기반 등급 업데이트
    const { User } = require('../models/User');
    const user = await User.findById(userId);
    if (user) {
      // 기본 신뢰도 증가 (100점 만점 기준)
      trustScoreIncrease = 1; // 기본 1점
      
      // 연속 달성일에 따른 보너스
      if (userChallenge.currentStreakCount >= 10) {
        trustScoreIncrease += 2; // 10일 연속: +2 보너스 (총 3점)
      } else if (userChallenge.currentStreakCount >= 7) {
        trustScoreIncrease += 1.5; // 7일 연속: +1.5 보너스 (총 2.5점)
      } else if (userChallenge.currentStreakCount >= 3) {
        trustScoreIncrease += 1; // 3일 연속: +1 보너스 (총 2점)
      }
      
      // 신뢰도는 100점을 넘지 않도록 제한
      user.trustScore = Math.min(100, user.trustScore + trustScoreIncrease);
      
      await user.save();
      
      console.log(`User ${userId} trust score increased by ${trustScoreIncrease} (total: ${user.trustScore}/100)`);
    }

    // 배지 획득 확인 및 등급 업데이트
    const { checkAndAwardBadges } = require('./badgeController');
    await checkAndAwardBadges(userId);

    // 배지 개수에 따른 등급 업데이트
    const updatedUser = await User.findById(userId);
    if (updatedUser) {
      const badgeCount = updatedUser.earnedBadges.length;
      let newGrade = 'bronze';
      
      // 배지 개수에 따른 등급 설정
      if (badgeCount >= 40) {
        newGrade = 'diamond';
      } else if (badgeCount >= 20) {
        newGrade = 'gold';
      } else if (badgeCount >= 10) {
        newGrade = 'silver';
      } else {
        newGrade = 'bronze';
      }
      
      // 등급이 변경된 경우에만 업데이트
      if (updatedUser.grade !== newGrade) {
        updatedUser.grade = newGrade;
        await updatedUser.save();
        console.log(`User ${userId} grade updated to ${newGrade} (${badgeCount} badges)`);
      }
    }

    // 챌린지 달성률 업데이트
    await updateCompletionRate(challengeId);

    const finalUser = await User.findById(userId);

    res.json({
      success: true,
      message: 'Challenge completed for today',
      data: {
        score: userChallenge.score,
        totalCompletions: userChallenge.totalCompletions,
        currentStreakCount: userChallenge.currentStreakCount,
        maxStreakCount: userChallenge.maxStreakCount,
        completedDate: today,
        photoUrl: photoUrl,
        trustScore: finalUser ? finalUser.trustScore : 0,
        trustScoreIncrease: trustScoreIncrease,
        currentGrade: finalUser ? finalUser.grade : 'bronze',
        totalBadges: finalUser ? finalUser.earnedBadges.length : 0
      }
    });
  } catch (error) {
    // 에러 발생 시 업로드된 파일 삭제
    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    console.error('Complete challenge error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const updateChallenge = async (req: AuthRequest, res: Response) => { // 챌린지 수정
  try {
    const challenge = await Challenge.findById(req.params.id);
    
    if (!challenge) {
      return res.status(404).json({ 
        success: false, 
        message: 'Challenge not found' 
      });
    }

    // 챌린지 생성자만 수정 가능
    if (challenge.createdBy.toString() !== req.user?.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    const updatedChallenge = await Challenge.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('createdBy', 'nickname profileImage');

    res.json({
      success: true,
      data: { challenge: updatedChallenge }
    });
  } catch (error) {
    console.error('Update challenge error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const deleteChallenge = async (req: AuthRequest, res: Response) => { // 챌린지 삭제
  try {
    const challenge = await Challenge.findById(req.params.id);
    
    if (!challenge) {
      return res.status(404).json({ 
        success: false, 
        message: 'Challenge not found' 
      });
    }

    if (challenge.createdBy.toString() !== req.user?.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    await Challenge.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Challenge deleted successfully'
    });
  } catch (error) {
    console.error('Delete challenge error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const leaveChallenge = async (req: AuthRequest, res: Response) => { // 챌린지 참여 취소
  try {
    const challengeId = req.params.id;
    const userId = req.user?.id;

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ 
        success: false, 
        message: 'Challenge not found' 
      });
    }

    // 참여자 목록에서 제거
    challenge.participants = challenge.participants.filter(
      participant => participant.userId.toString() !== userId
    );
    await challenge.save();

    // userInfo에서 UserChallenge 제거
    const userChallenge = await UserChallenge.findOne({ userId, challengeId });
    if (!userChallenge) {
      return res.status(404).json({ 
        success: false, 
        message: 'User challenge not found' 
      });
    }
    challenge.userInfo = challenge.userInfo.filter(
      info => info.toString() !== ((userChallenge._id) as mongoose.Types.ObjectId).toString()
    );
    await challenge.save();

    // UserChallenge 삭제
    await UserChallenge.findOneAndDelete({ userId, challengeId });

    res.json({
      success: true,
      message: 'Successfully left challenge'
    });
  } catch (error) {
    console.error('Leave challenge error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// 조회수 증가
export const increaseViewCount = async (req: Request, res: Response) => {
  try {
    await Challenge.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewCount: 1 } }
    );

    res.json({
      success: true,
      message: 'View count increased'
    });
  } catch (error) {
    console.error('Increase view count error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// 달성률 업데이트 함수 (챌린지 완료 시 호출)
export const updateCompletionRate = async (challengeId: string) => {
  try {
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return;

    const userChallenges = await UserChallenge.find({ challengeId });
    
    if (userChallenges.length === 0) {
      challenge.completionRate = 0;
    } else {
      // 더 정확한 달성률 계산
      let totalPossibleCompletions = 0;
      let totalActualCompletions = 0;

      userChallenges.forEach(uc => {
        // 각 사용자의 참여 기간 계산
        const daysSinceStart = Math.floor(
          (new Date().getTime() - uc.startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // 최소 1일, 최대 30일로 제한 (필요에 따라 조정)
        const possibleDays = Math.max(1, Math.min(daysSinceStart + 1, 30));
        
        totalPossibleCompletions += possibleDays;
        totalActualCompletions += uc.totalCompletions;
      });

      // 달성률 계산 (0-100%)
      challenge.completionRate = totalPossibleCompletions > 0 
        ? Math.round((totalActualCompletions / totalPossibleCompletions) * 100)
        : 0;
    }

    await challenge.save();
    
    console.log(`Challenge ${challengeId} completion rate updated to ${challenge.completionRate}%`);
  } catch (error) {
    console.error('Update completion rate error:', error);
  }
};

// 챌린지 이미지 업로드
export const uploadChallengeImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 8080}`;
    const imageUrl = `/uploads/challenges/${req.file.filename}`;

    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        imageUrl: imageUrl,
        fullUrl: `${baseUrl}${imageUrl}`
      }
    });
  } catch (error) {
    console.error('Upload challenge image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// 챌린지 이미지 업데이트
export const updateChallengeImage = async (req: AuthRequest, res: Response) => {
  try {
    const challengeId = req.params.id;
    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: 'Challenge not found'
      });
    }

    // 챌린지 생성자만 수정 가능
    if (challenge.createdBy.toString() !== req.user?.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // 기존 이미지 삭제
    if (challenge.image) {
      const oldImagePath = path.join(__dirname, '../../uploads/challenges', path.basename(challenge.image));
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // 새 이미지 URL 설정
    const imageUrl = `/uploads/challenges/${req.file.filename}`;
    challenge.image = imageUrl;
    await challenge.save();

    res.json({
      success: true,
      data: {
        imageUrl: imageUrl,
        message: 'Challenge image updated successfully'
      }
    });
  } catch (error) {
    console.error('Update challenge image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// 챌린지 이미지 삭제
export const deleteChallengeImage = async (req: AuthRequest, res: Response) => {
  try {
    const challengeId = req.params.id;
    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: 'Challenge not found'
      });
    }

    // 챌린지 생성자만 수정 가능
    if (challenge.createdBy.toString() !== req.user?.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // 기존 이미지 삭제
    if (challenge.image) {
      const imagePath = path.join(__dirname, '../../uploads/challenges', path.basename(challenge.image));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // 이미지 URL을 null로 설정
    challenge.image = null;
    await challenge.save();

    res.json({
      success: true,
      data: {
        image: null,
        message: 'Challenge image deleted successfully'
      }
    });
  } catch (error) {
    console.error('Delete challenge image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};