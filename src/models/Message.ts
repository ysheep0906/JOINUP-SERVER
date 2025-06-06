import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  challengeId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  message: string;
  timestamp: Date;
  messageType: 'text' | 'image' | 'system';
  isDeleted: boolean;
}

const messageSchema: Schema = new Schema({
  challengeId: {
    type: mongoose.Types.ObjectId,
    ref: 'Challenge',
    required: true
  },
  userId: {
    type: mongoose.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'system'],
    default: 'text'
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
});

// 인덱스 설정
messageSchema.index({ challengeId: 1, timestamp: -1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);