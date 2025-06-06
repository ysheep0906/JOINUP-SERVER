import express from 'express';
import { body } from 'express-validator';
import { 
  getBadges, 
  getBadgesByIds,
  createBadge, 
  getUserBadges, 
  updateBadge, 
  deleteBadge,
  updateRepresentativeBadges,
  checkAndAwardBadges

} from '../controllers/badgeController';
import auth from '../middleware/verifyJWT';

const router = express.Router();

// 모든 배지 조회
router.get('/', getBadges);

// 여러 배지 ID로 배지들 조회
router.post('/batch', getBadgesByIds);

// 특정 사용자의 배지 조회
router.get('/user/:userId', getUserBadges);

// 대표 배지 순서 변경
router.put('/representative', auth, updateRepresentativeBadges);

// 배지 획득 여부 확인 및 배지 부여
router.post('/check', auth, checkAndAwardBadges);

// 배지 생성 (인증된 사용자만)
// POST /api/badge
router.post('/', auth, [
  body('name').notEmpty().withMessage('Badge name is required'),
  body('description').notEmpty().withMessage('Badge description is required'),
  body('iconUrl').notEmpty()
    .withMessage('Badge icon is required')
    .custom((value) => {
      // URL 또는 이모지 둘 다 허용
      const isUrl = /^https?:\/\/.+/.test(value);
      const isEmoji = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(value);
      
      if (!isUrl && !isEmoji && value.length <= 10) {
        return true; // 짧은 문자열(이모지 등)은 허용
      }
      
      if (isUrl || isEmoji) {
        return true;
      }
      
      throw new Error('Must be a valid URL or emoji');
    }),
  body('category').optional().isIn(['health', 'exercise', 'study', 'hobby', 'lifestyle', 'social', 'other', 'achievement']),
  body('condition.type').isIn(['completions', 'streak', 'score', 'challenges', 'days', 'category_completions']).withMessage('Invalid condition type'),
  body('condition.value').isInt({ min: 1 }).withMessage('Condition value must be a positive integer'),
  body('condition.description').notEmpty().withMessage('Condition description is required'),
  body('condition.categoryTarget').optional().isIn(['health', 'exercise', 'study', 'hobby', 'lifestyle', 'social', 'other']),
  body('rarity').optional().isIn(['common', 'rare', 'epic', 'legendary'])
], createBadge);

// 배지 수정 (인증된 사용자만)
router.put('/:id', auth, [
  body('name').optional().notEmpty(),
  body('description').optional().notEmpty(),
  body('iconUrl').optional().notEmpty(),
  body('category').optional().isIn(['health', 'exercise', 'study', 'hobby', 'lifestyle', 'social', 'other', 'achievement']),
  body('condition.type').optional().isIn(['completions', 'streak', 'score', 'challenges', 'days', 'category_completions']),
  body('condition.value').optional().isInt({ min: 1 }),
  body('condition.description').optional().notEmpty(),
  body('condition.categoryTarget').optional().isIn(['health', 'exercise', 'study', 'hobby', 'lifestyle', 'social', 'other']),
  body('rarity').optional().isIn(['common', 'rare', 'epic', 'legendary'])
], updateBadge);

// 배지 삭제 (인증된 사용자만)
router.delete('/:id',
  auth,
  deleteBadge
);

export default router;