import express from 'express';
import { body } from 'express-validator';
import * as userController from '../controllers/userController';
import auth from '../middleware/verifyJWT';
import { uploadProfile } from '../middleware/upload';

const router = express.Router();

// POST /api/auth/register (프로필 이미지 선택적 업로드)
router.post('/register', 
  uploadProfile.single('profileImage'), // 선택적 이미지 업로드
  [
    body('socialId').notEmpty().withMessage('Social ID is required'),
    body('provider').isIn(['kakao', 'google']).withMessage('Invalid provider'),
    body('nickname').isLength({ min: 2, max: 20 }).withMessage('Nickname must be 2-20 characters'),
  ], 
  userController.register
);

// POST /api/auth/login
router.post('/login', [
  body('socialId').notEmpty().withMessage('Social ID is required'),
  body('provider').isIn(['kakao', 'google']).withMessage('Invalid provider'),
], userController.login);

// GET /api/auth/me
router.get('/me', auth, userController.getCurrentUser);

// PUT /api/auth/profile
router.put('/profile', auth, [
  body('nickname').optional().isLength({ min: 2, max: 20 }),
], userController.updateProfile);

// POST /api/auth/profile/image
router.post('/profile/image', auth, uploadProfile.single('profileImage'), userController.uploadProfileImage);

// DELETE /api/auth/profile/image
router.delete('/profile/image', auth, userController.deleteProfileImage);

// 특정 사용자 정보 조회
router.get('/:id', auth, userController.getUserById);

export default router;