# JoinUP Server

챌린지 기반 소셜 플랫폼의 백엔드 서버입니다. 사용자들이 다양한 챌린지에 참여하고, 실시간으로 소통하며, 배지 시스템을 통해 성취를 인정받을 수 있는 서비스를 제공합니다.

## 🚀 주요 기능

### 👤 사용자 관리
- 소셜 로그인 (카카오, 구글)
- 프로필 관리 (닉네임, 프로필 이미지)
- 사용자 등급 시스템 (Bronze, Silver, Gold, Diamond)
- 신뢰도 점수 시스템

### 🎯 챌린지 시스템
- 챌린지 생성, 수정, 삭제
- 챌린지 참여 및 탈퇴
- 사진 인증을 통한 챌린지 완료
- 카테고리별 챌린지 분류 (건강, 운동, 학습, 취미, 라이프스타일, 소셜, 기타)
- 챌린지 랭킹 시스템

### 🏆 배지 및 성취 시스템
- 다양한 조건 기반 배지 획득
- 대표 배지 설정 (최대 4개)
- 배지 희귀도 (Common, Rare, Epic, Legendary)
- 자동 배지 부여 시스템

### 💬 실시간 채팅
- Socket.IO 기반 실시간 메시징
- 챌린지별 채팅방
- 메시지 삭제 기능

### 📊 통계 및 랭킹
- 사용자별 챌린지 통계
- 전체 사용자 랭킹
- 챌린지별 참여자 랭킹
- 카테고리별 통계

## 🛠 기술 스택

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT
- **Real-time Communication**: Socket.IO
- **File Upload**: Multer
- **Validation**: Express Validator
- **Language**: TypeScript

## 📦 설치 및 실행

### 필요 조건
- Node.js (v14 이상)
- MongoDB

### 설치
```bash
# 저장소 클론
git clone https://github.com/your-username/joinup-server.git
cd joinup-server

# 의존성 설치
npm install
```

