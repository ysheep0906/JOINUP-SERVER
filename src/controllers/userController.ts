import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/authType';
import mongoose from 'mongoose';

export const register = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { socialId, provider, nickname } = req.body;
    console.log('Register request body:', req.body);
    let socialUser;

    // 프로바이더별 토큰 검증
    if (provider === 'kakao') {
      try {
        const kakaoUserRes = await axios.get(`https://kapi.kakao.com/v2/user/me`, {
          headers: {
            Authorization: `Bearer ${socialId}`,
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
          }
        });
        socialUser = {
          id: kakaoUserRes.data.id.toString(),
        };
      } catch (error) {
        console.error('Kakao API error:', error);
        return res.status(400).json({
          success: false,
          message: 'Invalid kakao token'
        });
      }
    } else if (provider === 'google') {
      try {
        const googleUserRes = await axios.get(`https://www.googleapis.com/oauth2/v2/userinfo`, {
          headers: {
            Authorization: `Bearer ${socialId}`
          }
        });
        socialUser = {
          id: googleUserRes.data.id,
        };
      } catch (error) {
        console.error('Google API error:', error);
        return res.status(400).json({
          success: false,
          message: 'Invalid google token'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported provider'
      });
    }

    if (!socialUser || !socialUser.id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid social token'
      });
    }

    // 기존 사용자 확인
    let user = await User.findOne({ socialId: socialUser.id, provider });
    if (user) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists' 
      });
    }

    // 닉네임 중복 확인
    const existingNickname = await User.findOne({ nickname });
    if (existingNickname) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nickname already taken' 
      });
    }

    // 프로필 이미지 처리
    let profileImageUrl = null; // 기본 이미지
    
    // 파일 업로드가 있는 경우
    if (req.file) {
      profileImageUrl = `/uploads/profiles/${req.file.filename}`;
    }

    // 새 사용자 생성
    user = new User({
      socialId: socialUser.id,
      provider,
      nickname,
      profileImage: profileImageUrl,
    });

    await user.save();

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          nickname: user.nickname,
          profileImage: user.profileImage,
        }
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    // 업로드 실패 시 파일 삭제
    if (req.file) {
      const filePath = path.join(__dirname, '../../uploads/profiles', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};
export const login = async (req: Request, res: Response) => { 
  try {  // 로그인 처리
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { socialId, provider } = req.body;
    let socialUser;

    // 프로바이더별 토큰 검증
    if (provider === 'kakao') {
      try {
        const kakaoUserRes = await axios.get(`https://kapi.kakao.com/v2/user/me`, {
          headers: {
            Authorization: `Bearer ${socialId}`,
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
          }
        });
        socialUser = {
          id: kakaoUserRes.data.id.toString(),
          email: kakaoUserRes.data.kakao_account?.email,
          nickname: kakaoUserRes.data.properties?.nickname,
          profileImage: kakaoUserRes.data.properties?.profile_image
        };
      } catch (error) {
        console.error('Kakao API error:', error);
        return res.status(400).json({
          success: false,
          message: 'Invalid kakao token'
        });
      }
    } else if (provider === 'google') {
      try {
        const googleUserRes = await axios.get(`https://www.googleapis.com/oauth2/v2/userinfo`, {
          headers: {
            Authorization: `Bearer ${socialId}`
          }
        });
        socialUser = {
          id: googleUserRes.data.id,
          email: googleUserRes.data.email,
          nickname: googleUserRes.data.name,
          profileImage: googleUserRes.data.picture
        };
      } catch (error) {
        console.error('Google API error:', error);
        return res.status(400).json({
          success: false,
          message: 'Invalid google token'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported provider'
      });
    }

    if (!socialUser || !socialUser.id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid social token'
      });
    }

    // DB에서 사용자 찾기
    const user = await User.findOne({ socialId: socialUser.id, provider });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          nickname: user.nickname,
          profileImage: user.profileImage,
          grade: user.grade,
          trustScore: user.trustScore
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// 현재 사용자 정보 조회
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.id).select('-socialId');
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { nickname } = req.body;
    const updateData: any = {};

    if (nickname) {
      // 닉네임 중복 확인
      const existingUser = await User.findOne({ 
        nickname, 
        _id: { $ne: req.user?.id } 
      });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'Nickname already taken' 
        });
      }
      updateData.nickname = nickname;
    }

    const user = await User.findByIdAndUpdate(
      req.user?.id,
      updateData,
      { new: true }
    ).select('-socialId');

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// 프로필 이미지 업로드
export const uploadProfileImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const userId = req.user?.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // 기존 프로필 이미지 삭제 (기본 이미지가 아닌 경우에만)
    if (user.profileImage && !user.profileImage.includes('/defaults/')) {
      const oldImagePath = path.join(__dirname, '../../uploads/profiles', path.basename(user.profileImage));
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // 새 이미지 파일명 저장
    const imageUrl = `/uploads/profiles/${req.file.filename}`;
    user.profileImage = imageUrl;
    await user.save();

    res.json({
      success: true,
      data: {
        profileImage: imageUrl,
        message: 'Profile image uploaded successfully'
      }
    });
  } catch (error) {
    console.error('Upload profile image error:', error);
    // 업로드 실패 시 파일 삭제
    if (req.file) {
      const filePath = path.join(__dirname, '../../uploads/profiles', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// 프로필 이미지 삭제 (기본 이미지로 되돌리기)
export const deleteProfileImage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // 기존 프로필 이미지가 있는 경우 삭제
    if (user.profileImage) {
      // 파일 시스템에서 이미지 삭제
      const imagePath = path.join(__dirname, '../../uploads/profiles', path.basename(user.profileImage));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // null로 변경
    user.profileImage = null;
    await user.save();

    res.json({
      success: true,
      data: {
        profileImage: null,
        message: 'Profile image deleted successfully'
      }
    });
  } catch (error) {
    console.error('Delete profile image error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// 특정 사용자 정보 조회 (ID로)
export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;

    // ObjectId 유효성 검사
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId)
      .select('-socialId') // 민감한 정보는 제외
      .populate('representativeBadges.badgeId')
      .populate('earnedBadges');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // 대표 배지를 순서대로 정렬
    const sortedRepresentativeBadges = user.representativeBadges
      .sort((a, b) => a.order - b.order);

    res.json({
      success: true,
      data: { 
        user: {
          id: user._id,
          nickname: user.nickname,
          profileImage: user.profileImage,
          grade: user.grade,
          trustScore: user.trustScore,
          representativeBadges: sortedRepresentativeBadges,
          totalBadges: user.earnedBadges.length,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};