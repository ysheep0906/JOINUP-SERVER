import multer from 'multer';
import path from 'path';
import fs from 'fs';

// uploads 디렉토리들 생성
const uploadsDir = path.join(__dirname, '../../uploads/profiles');
const defaultsDir = path.join(__dirname, '../../uploads/defaults');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(defaultsDir)) {
  fs.mkdirSync(defaultsDir, { recursive: true });
}

// multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // 파일명: userId_timestamp.확장자 (register 시에는 임시 이름)
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `temp_${timestamp}${ext}`);
  }
});

// 파일 필터 (이미지만 허용)
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

export const uploadProfile = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB 제한
  }
});