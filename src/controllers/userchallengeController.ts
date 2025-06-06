import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { User } from '../models/User';
import { UserChallenge } from '../models/UserChallenge';
import { AuthRequest } from '../middleware/authType';
import mongoose from 'mongoose';

export const getUserProfile = async (req: Request, res: Response) => { // 사용자 프로필 조회
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId).select('-socialId');
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // 사용자의 챌린지 통계
    const userChallenges = await UserChallenge.find({ userId })
      .populate('challengeId', 'title description');

    const stats = {
      totalChallenges: userChallenges.length,
      totalScore: userChallenges.reduce((sum, uc) => sum + uc.score, 0),
      totalCompletions: userChallenges.reduce((sum, uc) => sum + uc.totalCompletions, 0),
      maxStreakCount: Math.max(...userChallenges.map(uc => uc.maxStreakCount), 0),
      averageStreak: userChallenges.length > 0 
        ? userChallenges.reduce((sum, uc) => sum + uc.maxStreakCount, 0) / userChallenges.length 
        : 0
    };

    res.json({
      success: true,
      data: {
        user,
        stats,
        recentChallenges: userChallenges.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const getUserChallenges = async (req: AuthRequest, res: Response) => { // 사용자 챌린지 조회
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const userId = req.user?.id;
    const sortBy = req.query.sortBy as string || 'createdAt'; // createdAt, score, totalCompletions, maxStreakCount

    let sortQuery: any = {};
    switch (sortBy) {
      case 'score':
        sortQuery = { score: -1 };
        break;
      case 'totalCompletions':
        sortQuery = { totalCompletions: -1 };
        break;
      case 'maxStreakCount':
        sortQuery = { maxStreakCount: -1 };
        break;
      default:
        sortQuery = { createdAt: -1 };
    }

    const userChallenges = await UserChallenge.find({ userId })
      .populate('challengeId', 'title description frequency maxParticipants createdBy')
      .populate('challengeId.createdBy', 'nickname profileImage')
      .sort(sortQuery);

    res.json({
      success: true,
      data: { userChallenges }
    });
  } catch (error) {
    console.error('Get user challenges error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const getUserRanking = async (req: Request, res: Response) => { // 사용자 랭킹 조회
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const rankingType = req.query.type as string || 'score'; // score, completions, streak

    let groupField = 'totalScore';
    let sortField = 'totalScore';

    if (rankingType === 'completions') {
      groupField = 'totalCompletions';
      sortField = 'totalCompletions';
    } else if (rankingType === 'streak') {
      groupField = 'maxStreakCount';
      sortField = 'maxStreakCount';
    }

    // 사용자별 통계 계산
    const rankings = await UserChallenge.aggregate([
      {
        $group: {
          _id: '$userId',
          totalScore: { $sum: '$score' },
          challengeCount: { $sum: 1 },
          totalCompletions: { $sum: '$totalCompletions' },
          maxStreakCount: { $max: '$maxStreakCount' },
          currentStreakSum: { $sum: '$currentStreakCount' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          nickname: '$user.nickname',
          profileImage: '$user.profileImage',
          totalScore: 1,
          challengeCount: 1,
          totalCompletions: 1,
          maxStreakCount: 1,
          currentStreakSum: 1
        }
      },
      { $sort: { [sortField]: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ]);

    // 순위 추가
    const rankedResults = rankings.map((user, index) => ({
      ...user,
      rank: (page - 1) * limit + index + 1
    }));

    const total = await UserChallenge.aggregate([
      {
        $group: {
          _id: '$userId'
        }
      },
      {
        $count: 'total'
      }
    ]);

    res.json({
      success: true,
      data: {
        rankings: rankedResults,
        totalPages: Math.ceil((total[0]?.total || 0) / limit),
        currentPage: page,
        total: total[0]?.total || 0,
        rankingType
      }
    });
  } catch (error) {
    console.error('Get user ranking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const getUserChallengeDetail = async (req: AuthRequest, res: Response) => { // 특정 사용자 챌린지 상세 조회
  try {
    const challengeId = req.params.challengeId;
    const userId = req.user?.id;

    const userChallenge = await UserChallenge.findOne({ userId, challengeId })
      .populate('challengeId', 'title description rules cautions frequency maxParticipants createdBy')
      .populate('challengeId.createdBy', 'nickname profileImage');

    if (!userChallenge) {
      return res.status(404).json({ 
        success: false, 
        message: 'User challenge not found' 
      });
    }

    // 완료율 계산 (시작일부터 현재까지의 일수 대비 완료 일수)
    const daysSinceStart = Math.floor((new Date().getTime() - userChallenge.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const completionRate = daysSinceStart > 0 ? (userChallenge.totalCompletions / daysSinceStart) * 100 : 0;

    res.json({
      success: true,
      data: {
        userChallenge,
        completionRate: Math.min(completionRate, 100), // 최대 100%
        daysSinceStart
      }
    });
  } catch (error) {
    console.error('Get user challenge detail error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const getUserStats = async (req: AuthRequest, res: Response) => { // 사용자 전체 통계
  try {
    const userId = req.user?.id;

    const userChallenges = await UserChallenge.find({ userId });

    if (userChallenges.length === 0) {
      return res.json({
        success: true,
        data: {
          totalChallenges: 0,
          totalScore: 0,
          totalCompletions: 0,
          maxStreakCount: 0,
          averageScore: 0,
          averageCompletions: 0
        }
      });
    }

    const stats = {
      totalChallenges: userChallenges.length,
      totalScore: userChallenges.reduce((sum, uc) => sum + uc.score, 0),
      totalCompletions: userChallenges.reduce((sum, uc) => sum + uc.totalCompletions, 0),
      maxStreakCount: Math.max(...userChallenges.map(uc => uc.maxStreakCount)),
      averageScore: userChallenges.reduce((sum, uc) => sum + uc.score, 0) / userChallenges.length,
      averageCompletions: userChallenges.reduce((sum, uc) => sum + uc.totalCompletions, 0) / userChallenges.length,
      currentActiveStreaks: userChallenges.reduce((sum, uc) => sum + uc.currentStreakCount, 0)
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// 참여 중인 챌린지 조회 (UserChallenge 기반)
export const getParticipatingChallenges = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const userChallenges = await UserChallenge.find({ userId })
      .populate({
        path: 'challengeId',
        select: 'title description image category frequency maxParticipants viewCount participants createdBy createdAt',
        populate: {
          path: 'createdBy',
          select: 'nickname profileImage'
        }
      })
      .sort({ createdAt: -1 });

    // 각 챌린지에 추가 정보 계산
    const participatingChallenges = userChallenges.map(uc => {
      const challenge = uc.challengeId as any;
      const daysSinceStart = Math.floor((new Date().getTime() - uc.startDate.getTime()) / (1000 * 60 * 60 * 24));
      const completionRate = daysSinceStart > 0 ? Math.min((uc.totalCompletions / daysSinceStart) * 100, 100) : 0;

      return {
        userChallenge: {
          _id: uc._id,
          score: uc.score,
          totalCompletions: uc.totalCompletions,
          currentStreakCount: uc.currentStreakCount,
          maxStreakCount: uc.maxStreakCount,
          startDate: uc.startDate,
          lastCompletionDate: uc.lastCompletionDate,
          completedDates: uc.completedDates
        },
        challenge: challenge,
        stats: {
          daysSinceStart,
          completionRate: Math.round(completionRate * 100) / 100
        }
      };
    });
    console.log('Participating challenges:', participatingChallenges);
    res.json({
      success: true,
      data: {
        challenges: participatingChallenges,
        total: participatingChallenges.length
      }
    });
  } catch (error) {
    console.error('Get participating challenges error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// 오늘 완료 가능한 챌린지 조회
export const getTodayCompletableChallenges = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD 형식

    const userChallenges = await UserChallenge.find({ userId })
      .populate({
        path: 'challengeId',
        select: 'title description image category frequency',
        populate: {
          path: 'createdBy',
          select: 'nickname profileImage'
        }
      });

    const completableChallenges = userChallenges.filter(uc => {
      // 오늘 이미 완료했는지 확인
      const hasCompletedToday = uc.completedDates.some(date => {
        return date.toISOString().split('T')[0] === todayString;
      });

      // endDate가 없으므로 만료 체크는 제거하고 오늘 완료했는지만 확인
      return !hasCompletedToday;
    }).map(uc => ({
      userChallenge: {
        _id: uc._id,
        currentStreakCount: uc.currentStreakCount,
        totalCompletions: uc.totalCompletions,
        lastCompletionDate: uc.lastCompletionDate
      },
      challenge: uc.challengeId,
      canComplete: true
    }));

    res.json({
      success: true,
      data: {
        challenges: completableChallenges,
        total: completableChallenges.length,
        todayDate: todayString
      }
    });
  } catch (error) {
    console.error('Get today completable challenges error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// 사용자의 챌린지 통계 조회 (my-stats)
export const getMyChallengeStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const userChallenges = await UserChallenge.find({ userId });

    if (userChallenges.length === 0) {
      return res.json({
        success: true,
        data: {
          overview: {
            totalChallenges: 0,
            activeChallenges: 0,
            totalScore: 0,
            totalCompletions: 0
          },
          performance: {
            maxStreakCount: 0,
            currentActiveStreaks: 0,
            averageScore: 0,
            averageCompletions: 0,
            completionRate: 0
          },
          timeStats: {
            totalActiveDays: 0,
            averageActiveDays: 0
          }
        }
      });
    }

    // endDate 관련 부분 제거하고 기본 통계만 계산
    const totalScore = userChallenges.reduce((sum, uc) => sum + uc.score, 0);
    const totalCompletions = userChallenges.reduce((sum, uc) => sum + uc.totalCompletions, 0);
    const maxStreakCount = Math.max(...userChallenges.map(uc => uc.maxStreakCount), 0);
    const currentActiveStreaks = userChallenges.reduce((sum, uc) => sum + uc.currentStreakCount, 0);

    // 시간 관련 통계 (endDate 없이)
    const totalActiveDays = userChallenges.reduce((sum, uc) => sum + uc.completedDates.length, 0);

    // 완료율은 시작일부터 현재까지의 일수 대비로 계산
    const completionRates = userChallenges.map(uc => {
      const daysSinceStart = Math.floor((new Date().getTime() - uc.startDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceStart > 0 ? (uc.totalCompletions / daysSinceStart) * 100 : 0;
    });
    const averageCompletionRate = completionRates.length > 0 
      ? completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length 
      : 0;

    const stats = {
      overview: {
        totalChallenges: userChallenges.length,
        activeChallenges: userChallenges.length, // endDate가 없으므로 모든 챌린지를 활성으로 간주
        totalScore,
        totalCompletions
      },
      performance: {
        maxStreakCount,
        currentActiveStreaks,
        averageScore: Math.round((totalScore / userChallenges.length) * 100) / 100,
        averageCompletions: Math.round((totalCompletions / userChallenges.length) * 100) / 100,
        completionRate: Math.round(averageCompletionRate * 100) / 100
      },
      timeStats: {
        totalActiveDays,
        averageActiveDays: Math.round((totalActiveDays / userChallenges.length) * 100) / 100
      },
      categoryStats: await getCategoryStats(userId), // 카테고리별 통계
      recentActivity: await getRecentActivity(userId) // 최근 활동
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get my challenge stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// 카테고리별 통계 헬퍼 함수
const getCategoryStats = async (userId: string | undefined) => {
  try {
    const categoryStats = await UserChallenge.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: 'challenges',
          localField: 'challengeId',
          foreignField: '_id',
          as: 'challenge'
        }
      },
      { $unwind: '$challenge' },
      {
        $group: {
          _id: '$challenge.category',
          count: { $sum: 1 },
          totalScore: { $sum: '$score' },
          totalCompletions: { $sum: '$totalCompletions' },
          avgStreak: { $avg: '$maxStreakCount' }
        }
      },
      { $sort: { totalScore: -1 } }
    ]);

    return categoryStats;
  } catch (error) {
    console.error('Get category stats error:', error);
    return [];
  }
};

// 최근 활동 헬퍼 함수
const getRecentActivity = async (userId: string | undefined) => {
  try {
    const recentChallenges = await UserChallenge.find({ userId })
      .populate('challengeId', 'title category')
      .sort({ lastCompletionDate: -1 })
      .limit(5);

    return recentChallenges.map(uc => ({
      challengeTitle: (uc.challengeId as any)?.title,
      category: (uc.challengeId as any)?.category,
      lastCompletionDate: uc.lastCompletionDate,
      currentStreak: uc.currentStreakCount,
      totalCompletions: uc.totalCompletions
    }));
  } catch (error) {
    console.error('Get recent activity error:', error);
    return [];
  }
};

// 특정 챌린지의 참여자 랭킹 조회
export const getChallengeRanking = async (req: Request, res: Response) => {
  try {
    const challengeId = req.params.challengeId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const rankingType = req.query.type as string || 'score'; // score, completions, streak

    // challengeId 유효성 검사
    if (!mongoose.Types.ObjectId.isValid(challengeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid challenge ID format'
      });
    }

    // 해당 챌린지가 존재하는지 확인
    const Challenge = require('../models/Challenge').Challenge;
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: 'Challenge not found'
      });
    }

    let sortField = {};
    switch (rankingType) {
      case 'completions':
        sortField = { totalCompletions: -1, score: -1 }; // 완료 횟수 우선, 같으면 점수로
        break;
      case 'streak':
        sortField = { maxStreakCount: -1, currentStreakCount: -1, score: -1 }; // 최대 스트릭 우선
        break;
      default: // score
        sortField = { score: -1, totalCompletions: -1 }; // 점수 우선, 같으면 완료 횟수로
    }

    // 해당 챌린지의 UserChallenge들을 랭킹으로 조회
    const rankings = await UserChallenge.aggregate([
      {
        $match: { challengeId: new mongoose.Types.ObjectId(challengeId) }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          challengeId: 1,
          score: 1,
          totalCompletions: 1,
          currentStreakCount: 1,
          maxStreakCount: 1,
          startDate: 1,
          lastCompletionDate: 1,
          completedDates: 1,
          user: {
            _id: '$user._id',
            nickname: '$user.nickname',
            profileImage: '$user.profileImage',
            grade: '$user.grade'
          }
        }
      },
      {
        $sort: sortField
      },
      {
        $skip: (page - 1) * limit
      },
      {
        $limit: limit
      }
    ]);

    // 순위 추가 및 추가 통계 계산
    const rankedResults = rankings.map((userChallenge, index) => {
      const daysSinceStart = Math.floor((new Date().getTime() - userChallenge.startDate.getTime()) / (1000 * 60 * 60 * 24));
      const completionRate = daysSinceStart > 0 ? Math.min((userChallenge.totalCompletions / daysSinceStart) * 100, 100) : 0;

      return {
        rank: (page - 1) * limit + index + 1,
        userChallenge: {
          _id: userChallenge._id,
          score: userChallenge.score,
          totalCompletions: userChallenge.totalCompletions,
          currentStreakCount: userChallenge.currentStreakCount,
          maxStreakCount: userChallenge.maxStreakCount,
          startDate: userChallenge.startDate,
          lastCompletionDate: userChallenge.lastCompletionDate,
          completedDates: userChallenge.completedDates
        },
        user: userChallenge.user,
        stats: {
          daysSinceStart,
          completionRate: Math.round(completionRate * 100) / 100,
          activeDays: userChallenge.completedDates.length
        }
      };
    });

    // 전체 참여자 수 조회
    const totalParticipants = await UserChallenge.countDocuments({ challengeId });

    // 챌린지 통계 계산
    const challengeStats = await UserChallenge.aggregate([
      {
        $match: { challengeId: new mongoose.Types.ObjectId(challengeId) }
      },
      {
        $group: {
          _id: null,
          totalParticipants: { $sum: 1 },
          averageScore: { $avg: '$score' },
          highestScore: { $max: '$score' },
          averageCompletions: { $avg: '$totalCompletions' },
          highestCompletions: { $max: '$totalCompletions' },
          averageStreak: { $avg: '$maxStreakCount' },
          highestStreak: { $max: '$maxStreakCount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        challenge: {
          _id: challenge._id,
          title: challenge.title,
          category: challenge.category
        },
        rankings: rankedResults,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalParticipants / limit),
          totalParticipants,
          hasNext: (page - 1) * limit + rankings.length < totalParticipants,
          hasPrev: page > 1
        },
        stats: challengeStats[0] || {
          totalParticipants: 0,
          averageScore: 0,
          highestScore: 0,
          averageCompletions: 0,
          highestCompletions: 0,
          averageStreak: 0,
          highestStreak: 0
        },
        rankingType
      }
    });
  } catch (error) {
    console.error('Get challenge ranking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// 특정 챌린지에서 내 랭킹 조회
export const getMyChallengeRank = async (req: AuthRequest, res: Response) => {
  try {
    const challengeId = req.params.challengeId;
    const userId = req.user?.id;
    const rankingType = req.query.type as string || 'score';

    // challengeId 유효성 검사
    if (!mongoose.Types.ObjectId.isValid(challengeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid challenge ID format'
      });
    }

    // 내 UserChallenge 조회
    const myUserChallenge = await UserChallenge.findOne({ 
      userId, 
      challengeId 
    }).populate('userId', 'nickname profileImage grade');

    if (!myUserChallenge) {
      return res.status(404).json({
        success: false,
        message: 'User challenge not found'
      });
    }

    let matchCondition = {};
    let myValue = 0;

    switch (rankingType) {
      case 'completions':
        matchCondition = {
          challengeId: new mongoose.Types.ObjectId(challengeId),
          $or: [
            { totalCompletions: { $gt: myUserChallenge.totalCompletions } },
            { 
              totalCompletions: myUserChallenge.totalCompletions,
              score: { $gt: myUserChallenge.score }
            }
          ]
        };
        myValue = myUserChallenge.totalCompletions;
        break;
      case 'streak':
        matchCondition = {
          challengeId: new mongoose.Types.ObjectId(challengeId),
          $or: [
            { maxStreakCount: { $gt: myUserChallenge.maxStreakCount } },
            {
              maxStreakCount: myUserChallenge.maxStreakCount,
              currentStreakCount: { $gt: myUserChallenge.currentStreakCount }
            },
            {
              maxStreakCount: myUserChallenge.maxStreakCount,
              currentStreakCount: myUserChallenge.currentStreakCount,
              score: { $gt: myUserChallenge.score }
            }
          ]
        };
        myValue = myUserChallenge.maxStreakCount;
        break;
      default: // score
        matchCondition = {
          challengeId: new mongoose.Types.ObjectId(challengeId),
          $or: [
            { score: { $gt: myUserChallenge.score } },
            {
              score: myUserChallenge.score,
              totalCompletions: { $gt: myUserChallenge.totalCompletions }
            }
          ]
        };
        myValue = myUserChallenge.score;
        break;
    }

    // 나보다 높은 순위의 사용자 수 계산
    const higherRankCount = await UserChallenge.countDocuments(matchCondition);
    const myRank = higherRankCount + 1;

    // 전체 참여자 수
    const totalParticipants = await UserChallenge.countDocuments({ challengeId });

    // 내 통계 계산
    const daysSinceStart = Math.floor((new Date().getTime() - myUserChallenge.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const completionRate = daysSinceStart > 0 ? Math.min((myUserChallenge.totalCompletions / daysSinceStart) * 100, 100) : 0;

    res.json({
      success: true,
      data: {
        rank: myRank,
        totalParticipants,
        userChallenge: {
          _id: myUserChallenge._id,
          score: myUserChallenge.score,
          totalCompletions: myUserChallenge.totalCompletions,
          currentStreakCount: myUserChallenge.currentStreakCount,
          maxStreakCount: myUserChallenge.maxStreakCount,
          startDate: myUserChallenge.startDate,
          lastCompletionDate: myUserChallenge.lastCompletionDate
        },
        user: myUserChallenge.userId,
        stats: {
          daysSinceStart,
          completionRate: Math.round(completionRate * 100) / 100,
          activeDays: myUserChallenge.completedDates.length,
          percentile: Math.round(((totalParticipants - myRank + 1) / totalParticipants) * 100)
        },
        rankingType,
        value: myValue
      }
    });
  } catch (error) {
    console.error('Get my challenge rank error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};