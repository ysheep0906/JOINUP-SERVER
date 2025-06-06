import mongoose, { Document, Schema } from "mongoose";

export interface IBadge extends Document {
  name: string; // 배지 이름
  description: string; // 배지 설명
  iconUrl: string; // 배지 아이콘 URL
  category: 'health' | 'exercise' | 'study' | 'hobby' | 'lifestyle' | 'social' | 'other' | 'achievement'; // 배지 카테고리
  condition: { // 배지 획득 조건
    type: 'completions' | 'streak' | 'score' | 'challenges' | 'days' | 'category_completions'; // 조건 타입
    value: number; // 필요한 값
    categoryTarget?: string; // 특정 카테고리 조건일 때 사용
    description: string; // 조건 설명
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary'; // 배지 희귀도
  createdAt: Date; // 생성일
}

const badgeSchema = new Schema<IBadge>({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  iconUrl: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['health', 'exercise', 'study', 'hobby', 'lifestyle', 'social', 'other', 'achievement'],
    required: true,
    default: 'achievement'
  },
  condition: {
    type: {
      type: String,
      enum: ['completions', 'streak', 'score', 'challenges', 'days', 'category_completions'],
      required: true
    },
    value: {
      type: Number,
      required: true,
      min: 1
    },
    categoryTarget: {
      type: String,
      enum: ['health', 'exercise', 'study', 'hobby', 'lifestyle', 'social', 'other']
    },
    description: {
      type: String,
      required: true
    }
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 카테고리별 인덱스
badgeSchema.index({ category: 1, rarity: 1 });

// 조건 타입별 인덱스
badgeSchema.index({ 'condition.type': 1, 'condition.value': 1 });

export const Badge = mongoose.model<IBadge>('Badge', badgeSchema);