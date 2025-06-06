import mongoose, { Document, Schema, Types } from "mongoose";

export interface IChallenge extends Document {
  title: string; // 챌린지 
  image?: string | null; // 챌린지 이미지 URL (선택적)
  description: string; // 챌린지 설명
  rules: string; // 챌린지 규칙
  cautions: string; // 챌린지 주의사항
  category: 'health' | 'exercise' | 'study' | 'hobby' | 'lifestyle' | 'social' | 'other'; // 챌린지 카테고리
  createdBy: Types.ObjectId; // 챌린지를 생성한 사용자 ID
  viewCount: number; // 조회수
  completionRate: number; // 평균 달성률 (%)
  participants: { // 챌린지 참여자 정보
    userId: Types.ObjectId; // 사용자 ID
    joinedAt: Date; // 참여한 날짜
  }[];
  maxParticipants: number; // 챌린지 최대 참여 인원
  frequency: { // 챌린지 주기
    type: 'daily' | 'weekly' | 'monthly'; // 주기 유형
    interval: number; // 주기 간격 (예: 매주, 매월 등)
  };
  userInfo: Types.ObjectId[]; // 챌린지 참여자 정보
  createdAt: Date; // 챌린지 생성일
}

const challengeSchema = new Schema<IChallenge>({
  title: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    default: null // 챌린지 이미지 URL (선택적)
  },
  description: {
    type: String,
    required: true
  },
  rules: {
    type: String,
    required: true
  },
  cautions: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['health', 'exercise', 'study', 'hobby', 'lifestyle', 'social', 'other'],
    required: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  completionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  participants: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  maxParticipants: {
    type: Number,
    required: true,
    min: 1
  },
  frequency: {
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true
    },
    interval: {
      type: Number,
      required: true,
      min: 1
    }
  },
  userInfo: [{
    type: Schema.Types.ObjectId,
    ref: 'UserChallenge'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

challengeSchema.index({ title: 'text', description: 'text' });

export const Challenge = mongoose.model<IChallenge>('Challenge', challengeSchema);