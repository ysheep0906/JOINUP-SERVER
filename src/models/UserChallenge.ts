import mongoose, { Document, Schema, Types } from "mongoose";

export interface IUserChallenge extends Document {
  userId: Types.ObjectId; // 사용자 ID
  challengeId: Types.ObjectId; // 챌린지 ID
  completedDates: Date[]; // 완료일 리스트
  completionPhotos: { // 완료 인증 사진들
    date: Date; // 완료일
    photoUrl: string; // 사진 URL
  }[];
  startDate: Date; // 시작일
  rank: number; // 랭크
  score: number; // 점수
  totalCompletions: number; // 총 인증 횟수
  currentStreakCount: number; // 현재 연속 인증 횟수
  maxStreakCount: number; // 최대 연속 인증 횟수
  lastCompletionDate: Date; // 마지막 인증 날짜
}

const userChallengeSchema = new Schema<IUserChallenge>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  challengeId: {
    type: Schema.Types.ObjectId,
    ref: 'Challenge',
    required: true
  },
  completedDates: [{
    type: Date
  }],
  completionPhotos: [{
    date: {
      type: Date,
      required: true
    },
    photoUrl: {
      type: String,
      required: true
    }
  }],
  startDate: {
    type: Date,
    required: true
  },
  rank: {
    type: Number,
    default: 0
  },
  score: {
    type: Number,
    default: 0
  },
  totalCompletions: {
    type: Number,
    default: 0
  },
  currentStreakCount: {
    type: Number,
    default: 0
  },
  maxStreakCount: {
    type: Number,
    default: 0
  },
  lastCompletionDate: {
    type: Date
  },
}, {
  timestamps: true
});

userChallengeSchema.index({ userId: 1, challengeId: 1 }, { unique: true });

export const UserChallenge = mongoose.model<IUserChallenge>('UserChallenge', userChallengeSchema);