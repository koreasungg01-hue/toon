
# BANGKKU TOONGKU

초대 회원 전용 프리미엄 웹툰 플랫폼.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Authentication: Firebase Authentication
- Database: Cloud Firestore
- Images: Firebase Storage
- Frontend hosting: Vercel
- Backend hosting: Render

## Local development

1. Node.js 20 이상을 설치한다.
2. 루트에서 `npm install`을 실행한다.
3. 루트 `.env.example`을 참고해 로컬 환경 변수를 설정한다.
4. Firebase Console에서 이메일/비밀번호 인증, Firestore, Storage를 활성화한다.
5. Firebase Admin 인증을 로컬 환경에 안전하게 설정한다.
6. `npm run dev`를 실행한다.

Frontend: http://localhost:5173  
Backend health: http://localhost:8787/api/health

## Deployment

### Vercel
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Firebase 웹 설정과 `VITE_API_BASE_URL`을 환경 변수에 등록한다.

### Render
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- `PORT`, `NODE_ENV`, `CLIENT_ORIGIN`, `FIREBASE_PROJECT_ID`,
  `ADMIN_UIDS`, Firebase Admin 인증을 설정한다.

## Security
- 실제 `.env` 파일과 서비스 계정 키를 GitHub에 올리지 않는다.
- 코인 잔액과 구매 기록은 서버에서만 변경한다.
- 관리자 권한은 서버에서 확인한다.
- 테스트 코인은 현금 가치가 없다.
