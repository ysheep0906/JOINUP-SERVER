import mongoose, { Document, Schema, Types } from "mongoose";
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  provider: 'kakao' | 'google'; // 소셜 로그인 제공자
  socialId: string; // 소셜 로그인 ID
  nickname?: string; // 사용자 닉네임
  profileImage?: string | null; // 프로필 이미지 URL (선택적)
  grade: 'bronze' | 'silver' | 'gold' | 'Diamond'; // 사용자 등급
  trustScore: number; // 신뢰도 점수
  representativeBadges: {
    badgeId: Types.ObjectId;
    order: number; // 순서 (1, 2, 3, 4)
  }[]; // 대표 배지 ID와 순서 목록
  earnedBadges: Types.ObjectId[]; // 획득한 배지 ID 목록
  createdAt: Date; // 생성일
}

const userSchema = new Schema<IUser>({
  provider: {
    type: String,
    required: true,
    enum: ['kakao', 'google']
  },
  socialId: {
    type: String,
    required: true,
    unique: true
  },
  nickname: {
    type: String,
    unique: true,
    trim: true
  },
  profileImage: {
    type: String,
    default: null
  },
  grade: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'diamond'],
    default: 'bronze'
  },
  trustScore: {
    type: Number,
    default: 0
  },
  representativeBadges: [{
    badgeId: {
      type: Schema.Types.ObjectId,
      ref: 'Badge',
      required: true
    },
    order: {
      type: Number,
      required: true,
      min: 1,
      max: 4
    }
  }],
  earnedBadges: [{
    type: Schema.Types.ObjectId,
    ref: 'Badge'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 대표 배지 개수 제한 검증
userSchema.path('representativeBadges').validate(function(value: any[]) {
  return value.length <= 4;
}, 'Representative badges exceed the limit of 4');

// 대표 배지 순서 중복 검증
userSchema.path('representativeBadges').validate(function(value: any[]) {
  const orders = value.map(item => item.order);
  return orders.length === new Set(orders).size;
}, 'Representative badge orders must be unique');

export const User = mongoose.model<IUser>('User', userSchema);