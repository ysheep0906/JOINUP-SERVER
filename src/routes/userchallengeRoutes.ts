import express from 'express';
import { query } from 'express-validator';
import * as userchallengeController from '../controllers/userchallengeController';
import auth from '../middleware/verifyJWT';

const router = express.Router();

// GET /api/userchallenge/profile/:id
router.get('/profile/:id', userchallengeController.getUserProfile);

// GET /api/userchallenge/challenges
router.get('/challenges', auth, [
  query('status').optional().isIn(['active', 'completed', 'all']),
], userchallengeController.getUserChallenges);

// GET /api/userchallenge/participating - 참여 중인 챌린지 조회
router.get('/participating', auth, userchallengeController.getParticipatingChallenges);

// GET /api/userchallenge/completable-today - 오늘 완료 가능한 챌린지 조회
router.get('/completable-today', auth, userchallengeController.getTodayCompletableChallenges);

// GET /api/userchallenge/my-stats - 사용자의 챌린지 통계 조회
router.get('/my-stats', auth, userchallengeController.getMyChallengeStats);

// GET /api/userchallenge/ranking
router.get('/ranking', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], userchallengeController.getUserRanking);

// GET /api/userchallenge/detail/:challengeId - 특정 챌린지 상세 조회
router.get('/detail/:challengeId', auth, userchallengeController.getUserChallengeDetail);

// GET /api/userchallenge/stats - 사용자 전체 통계 (기존)
router.get('/stats', auth, userchallengeController.getUserStats);

// GET /api/userchallenge/challenge/:challengeId/ranking - 특정 챌린지 랭킹 조회
router.get('/challenge/:challengeId/ranking', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('type').optional().isIn(['score', 'completions', 'streak'])
], userchallengeController.getChallengeRanking);

// GET /api/userchallenge/challenge/:challengeId/my-rank - 특정 챌린지에서 내 랭킹 조회
router.get('/challenge/:challengeId/my-rank', auth, [
  query('type').optional().isIn(['score', 'completions', 'streak'])
], userchallengeController.getMyChallengeRank);

export default router;