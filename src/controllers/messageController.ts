import { Request, Response } from 'express';
import { Message } from '../models/Message';
import { AuthRequest } from '../middleware/authType';

// 채팅 메시지 목록 조회
export const getChallengeMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { challengeId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const messages = await Message.find({
      challengeId,
      isDeleted: false
    })
    .populate('userId', 'nickname profileImage')
    .sort({ timestamp: -1 })
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit));

    // 최신 순으로 다시 정렬
    messages.reverse();

    res.status(200).json({
      success: true,
      data: {
        messages
      }
    });
  } catch (error) {
    console.error('Error getting challenge messages:', error);
    res.status(500).json({
      success: false,
      message: '메시지 조회 중 오류가 발생했습니다.'
    });
  }
};

// 메시지 저장 (소켓에서 호출)
export const saveMessage = async (messageData: {
  challengeId: string;
  userId: string;
  message: string;
  messageType?: string;
}) => {
  try {
    const newMessage = new Message({
      challengeId: messageData.challengeId,
      userId: messageData.userId,
      message: messageData.message,
      messageType: messageData.messageType || 'text'
    });

    await newMessage.save();
    return newMessage;
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
};

// 메시지 삭제
export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: '메시지를 찾을 수 없습니다.'
      });
    }

    // 본인이 작성한 메시지만 삭제 가능
    if (message.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: '삭제 권한이 없습니다.'
      });
    }

    message.isDeleted = true;
    await message.save();

    res.status(200).json({
      success: true,
      message: '메시지가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: '메시지 삭제 중 오류가 발생했습니다.'
    });
  }
};