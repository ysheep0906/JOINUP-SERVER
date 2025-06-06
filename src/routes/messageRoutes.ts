import express from 'express';
import * as messageController from '../controllers/messageController';
import auth from '../middleware/verifyJWT';

const router = express.Router();

// GET /api/message/challenge/:challengeId - 챌린지 메시지 목록
router.get('/challenge/:challengeId', auth, messageController.getChallengeMessages);

// DELETE /api/message/:messageId - 메시지 삭제
router.delete('/:messageId', auth, messageController.deleteMessage);

export default router;