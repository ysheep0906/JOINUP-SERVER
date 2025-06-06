import express from 'express';
import { body, query } from 'express-validator';
import * as challengeController from '../controllers/challengeController';
import auth from '../middleware/verifyJWT';
import { challengeImageUpload, uploadChallengeImage, updateChallengeImage, deleteChallengeImage, completionPhotoUpload } from '../controllers/challengeController';

const router = express.Router();

// GET /api/challenges
router.get('/', [ // 리스트 조회를 위한 유효성 검사
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 9999 }),
  query('search').optional().isString(),
], challengeController.getChallenges);

// GET /api/challenges/:id
router.get('/:id', challengeController.getChallengeById); // 특정 챌린지 조회

// 조회수 증가 (별도 엔드포인트)
router.patch('/:id/view', challengeController.increaseViewCount);

// 챌린지 이미지 업로드 (단독)
router.post('/upload-image', auth, challengeImageUpload.single('image'), uploadChallengeImage);

// POST /api/challenges
router.post('/', auth, challengeImageUpload.single('image'), [ // 챌린지 생성 시 유효성 검사
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('rules').notEmpty().withMessage('Rules are required'),
  body('cautions').notEmpty().withMessage('Cautions are required'),
  body('category').isIn(['health', 'exercise', 'study', 'hobby', 'lifestyle', 'social', 'other']),
  body('maxParticipants').isInt({ min: 1 }).withMessage('Max participants must be at least 1'),
  body('frequency.type').isIn(['daily', 'weekly', 'monthly']),
  body('frequency.interval').isInt({ min: 1 }),
], challengeController.createChallenge);

// PUT /api/challenges/:id
router.put('/:id', auth, challengeController.updateChallenge); // 챌린지 수정

// DELETE /api/challenges/:id
router.delete('/:id', auth, challengeController.deleteChallenge); // 챌린지 삭제

// POST /api/challenges/:id/join
router.post('/:id/join', auth, challengeController.joinChallenge); // 챌린지 참여

// DELETE /api/challenges/:id/leave
router.delete('/:id/leave', auth, challengeController.leaveChallenge); // 챌린지 탈퇴

// POST /api/challenges/:id/complete
router.post('/:id/complete', auth, completionPhotoUpload.single('photo'), challengeController.completeChallenge); // 챌린지 완료

// 챌린지 이미지 업데이트
router.put('/:id/image', auth, challengeImageUpload.single('image'), updateChallengeImage);

// 챌린지 이미지 삭제
router.delete('/:id/image', auth, deleteChallengeImage);

export default router;