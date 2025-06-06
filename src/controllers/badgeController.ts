import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Badge } from '../models/Badge';
import { User } from '../models/User';
import { UserChallenge } from '../models/UserChallenge';
import { AuthRequest } from '../middleware/authType';
import mongoose from 'mongoose';

export const getBadges = async (req: Request, res: Response) => { // 모든 배지 조회
  try {
    const badges = await Badge.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { badges }
    });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const getBadgesByIds = async (req: Request, res: Response) => { // 여러 배지 ID로 배지들 조회
  try {
    const { ids } = req.body; // POST body에서 배지 ID 배열 받기

    // 입력 유효성 검사
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Badge IDs array is required'
      });
    }

    // 각 ID가 유효한 ObjectId인지 확인
    const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid badge ID format: ${invalidIds.join(', ')}`
      });
    }

    const badges = await Badge.find({ _id: { $in: ids } }).sort({ createdAt: -1 });

    // 찾지 못한 ID들 확인
    const foundIds = badges.map(badge => badge._id as mongoose.Types.ObjectId);
    const notFoundIds = ids.filter(id => !foundIds.includes(id as mongoose.Types.ObjectId));

    res.json({
      success: true,
      data: { 
        badges,
        found: badges.length,
        total: ids.length,
        notFound: notFoundIds.length > 0 ? notFoundIds : undefined
      }
    });
  } catch (error) {
    console.error('Get badges by IDs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const createBadge = async (req: AuthRequest, res: Response) => { // 배지 생성 (관리자용)
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { 
      name, 
      description, 
      iconUrl, 
      category, 
      condition, 
      rarity 
    } = req.body;

    // condition 유효성 검사
    if (!condition || !condition.type || !condition.value || !condition.description) {
      return res.status(400).json({
        success: false,
        message: 'Condition (type, value, description) is required'
      });
    }

    // category_completions 타입일 때 categoryTarget 필수 확인
    if (condition.type === 'category_completions' && !condition.categoryTarget) {
      return res.status(400).json({
        success: false,
        message: 'categoryTarget is required for category_completions condition'
      });
    }

    const badge = new Badge({
      name,
      description,
      iconUrl,
      category: category || 'achievement', // 기본값
      condition: {
        type: condition.type,
        value: condition.value,
        categoryTarget: condition.categoryTarget,
        description: condition.description
      },
      rarity: rarity || 'common' // 기본값
    });

    await badge.save();

    res.status(201).json({
      success: true,
      data: { badge }
    });
  } catch (error: any) {
    console.error('Create badge error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Badge name already exists' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const updateRepresentativeBadges = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { badges } = req.body; // [{ badgeId: "id1", order: 1 }, { badgeId: "id2", order: 2 }]

    // 입력 유효성 검사
    if (!Array.isArray(badges) || badges.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Invalid badges array. Maximum 4 badges allowed.'
      });
    }

    // 순서 검증 (1~4, 중복 없음)
    const orders = badges.map(b => b.order);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size || orders.some(o => o < 1 || o > 4)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order values. Orders must be unique and between 1-4.'
      });
    }

    // badgeId 유효성 검사
    const invalidBadgeIds = badges.filter(b => !mongoose.Types.ObjectId.isValid(b.badgeId));
    if (invalidBadgeIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid badge ID format'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // 사용자가 실제로 획득한 배지인지 확인 (earnedBadges에서 확인)
    const earnedBadgeIds = user.earnedBadges.map(id => id.toString());
    const notEarnedBadges = badges.filter(badge => 
      !earnedBadgeIds.includes(badge.badgeId.toString())
    );

    if (notEarnedBadges.length > 0) {
      return res.status(400).json({
        success: false,
        message: `You haven't earned these badges: ${notEarnedBadges.map(b => b.badgeId).join(', ')}`
      });
    }

    // 대표 배지 업데이트
    user.representativeBadges = badges.map(b => ({
      badgeId: new mongoose.Types.ObjectId(b.badgeId),
      order: b.order
    }));

    await user.save();

    // 업데이트된 대표 배지 정보를 populate해서 반환
    const updatedUser = await User.findById(userId)
      .populate('representativeBadges.badgeId')
      .select('representativeBadges');

    const sortedRepresentativeBadges = updatedUser!.representativeBadges
      .sort((a, b) => a.order - b.order);

    res.json({
      success: true,
      message: 'Representative badges updated successfully',
      data: { representativeBadges: sortedRepresentativeBadges }
    });
  } catch (error) {
    console.error('Update representative badges error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const getUserBadges = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId)
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
      .sort((a, b) => a.order - b.order)
      .map(item => ({
        badge: item.badgeId,
        order: item.order
      }));

    res.json({
      success: true,
      data: { 
        representativeBadges: sortedRepresentativeBadges,
        earnedBadges: user.earnedBadges,
        totalEarned: user.earnedBadges.length,
        representativeCount: user.representativeBadges.length
      }
    });
  } catch (error) {
    console.error('Get user badges error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const checkAndAwardBadges = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id; // 현재 인증된 사용자 ID
    const userChallenges = await UserChallenge.find({ userId }).populate('challengeId', 'category');
    const user = await User.findById(userId);
    
    if (!user || !userChallenges) return;

    // 사용자 통계 계산
    const totalCompletions = userChallenges.reduce((sum, uc) => sum + uc.totalCompletions, 0);
    const maxStreak = Math.max(...userChallenges.map(uc => uc.maxStreakCount), 0);
    const totalScore = userChallenges.reduce((sum, uc) => sum + uc.score, 0);
    const totalChallenges = userChallenges.length;
    
    // 카테고리별 완료 횟수 계산
    const categoryCompletions: { [key: string]: number } = {};
    userChallenges.forEach(uc => {
      if (uc.challengeId && typeof uc.challengeId === 'object' && 'category' in uc.challengeId) {
        const category = (uc.challengeId as any).category || 'other';
        categoryCompletions[category] = (categoryCompletions[category] || 0) + uc.totalCompletions;
      }
    });

    const totalActiveDays = userChallenges.reduce((sum, uc) => sum + uc.completedDates.length, 0);

    const allBadges = await Badge.find();
    
    for (const badge of allBadges) {
      const badgeId = badge._id as mongoose.Types.ObjectId;
      
      // 이미 획득한 배지인지 확인
      if (user.earnedBadges.includes(badgeId)) {
        continue;
      }

      let conditionMet = false;

      switch (badge.condition.type) {
        case 'completions':
          conditionMet = totalCompletions >= badge.condition.value;
          break;
        case 'streak':
          conditionMet = maxStreak >= badge.condition.value;
          break;
        case 'score':
          conditionMet = totalScore >= badge.condition.value;
          break;
        case 'challenges':
          conditionMet = totalChallenges >= badge.condition.value;
          break;
        case 'days':
          conditionMet = totalActiveDays >= badge.condition.value;
          break;
        case 'category_completions':
          if (badge.condition.categoryTarget) {
            const categoryCount = categoryCompletions[badge.condition.categoryTarget] || 0;
            conditionMet = categoryCount >= badge.condition.value;
          }
          break;
      }

      // 조건을 만족하면 배지 수여
      if (conditionMet) {
        // earnedBadges에 추가
        user.earnedBadges.push(badgeId);
        
        // representativeBadges에도 추가 (최대 4개까지, 순서는 자동으로 다음 번호)
        if (user.representativeBadges.length < 4) {
          const nextOrder = user.representativeBadges.length + 1;
          user.representativeBadges.push({
            badgeId: badgeId,
            order: nextOrder
          });
        }
      }
    }

    await user.save();
  } catch (error) {
    console.error('Check and award badges error:', error);
  }
};

export const updateBadge = async (req: AuthRequest, res: Response) => { // 배지 수정 (관리자용)
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const badgeId = req.params.id;
    const { 
      name, 
      description, 
      iconUrl, 
      category, 
      condition, 
      rarity 
    } = req.body;

    const updateData: any = {};

    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (iconUrl) updateData.iconUrl = iconUrl;
    if (category) updateData.category = category;
    if (rarity) updateData.rarity = rarity;

    if (condition) {
      // condition 유효성 검사
      if (!condition.type || !condition.value || !condition.description) {
        return res.status(400).json({
          success: false,
          message: 'Condition must include type, value, and description'
        });
      }

      // category_completions 타입일 때 categoryTarget 필수 확인
      if (condition.type === 'category_completions' && !condition.categoryTarget) {
        return res.status(400).json({
          success: false,
          message: 'categoryTarget is required for category_completions condition'
        });
      }

      updateData.condition = {
        type: condition.type,
        value: condition.value,
        categoryTarget: condition.categoryTarget,
        description: condition.description
      };
    }

    const badge = await Badge.findByIdAndUpdate(
      badgeId,
      updateData,
      { new: true }
    );

    if (!badge) {
      return res.status(404).json({ 
        success: false, 
        message: 'Badge not found' 
      });
    }

    res.json({
      success: true,
      data: { badge }
    });
  } catch (error) {
    console.error('Update badge error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const deleteBadge = async (req: AuthRequest, res: Response) => { // 배지 삭제 (관리자용)
  try {
    const badgeId = req.params.id;

    const badge = await Badge.findByIdAndDelete(badgeId);
    if (!badge) {
      return res.status(404).json({ 
        success: false, 
        message: 'Badge not found' 
      });
    }

    // 사용자들의 배지에서도 제거
    await User.updateMany(
      { representativeBadges: badgeId },
      { $pull: { representativeBadges: badgeId } }
    );

    res.json({
      success: true,
      message: 'Badge deleted successfully'
    });
  } catch (error) {
    console.error('Delete badge error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};