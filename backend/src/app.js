// backend/src/app.js

import express from "express";
import cors from "cors";
import helmet from "helmet";

import inviteRoutes from "./routes/invite.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import purchaseRoutes from "./routes/purchase.routes.js";
import webtoonRoutes from "./routes/webtoon.routes.js";

import { authenticate } from "./middleware/authenticate.js";
import { requireApproved } from "./middleware/requireApproved.js";
import { requireAdmin } from "./middleware/requireAdmin.js";

import { initializeWallet } from "./services/wallet.service.js";

const app = express();

// --------------------------------------------------
// 기본 설정
// --------------------------------------------------

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: (process.env.CLIENT_ORIGIN || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// --------------------------------------------------
// 상태 확인
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "BANGKKU TOONGKU API is running.",
    timestamp: new Date().toISOString(),
  });
});

// --------------------------------------------------
// 현재 로그인 사용자 정보
// --------------------------------------------------

app.get(
  "/api/me",
  authenticate,
  async (req, res, next) => {
    try {
      const { db } = await import("./config/firebaseAdmin.js");

      const userRef = db.collection("users").doc(req.user.uid);
      const snapshot = await userRef.get();

      if (!snapshot.exists) {
        return res.status(404).json({
          success: false,
          message: "회원 프로필을 찾을 수 없습니다.",
        });
      }

      const user = snapshot.data();

      return res.json({
        success: true,
        user: {
          uid: req.user.uid,
          email: req.user.email || null,
          nickname: user.nickname || "",
          role: user.role || "member",
          status: user.status || "pending",
          inviteConsumed: user.inviteConsumed === true,
          createdAt: user.createdAt || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// --------------------------------------------------
// 초대 코드 API
// --------------------------------------------------

app.use("/api/invites", inviteRoutes);

// --------------------------------------------------
// 지갑 API
// --------------------------------------------------

app.use("/api/wallet", walletRoutes);

// --------------------------------------------------
// 회차 구매 및 구매 내역 API
// --------------------------------------------------

app.use("/api/purchases", purchaseRoutes);

// --------------------------------------------------
// 웹툰·회차 관리 API
// --------------------------------------------------


app.use("/api/webtoons", webtoonRoutes);


// --------------------------------------------------
// 관리자: 승인 대기 회원 목록
// --------------------------------------------------

app.get(
  "/api/admin/pending-users",
  authenticate,
  requireApproved,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { db } = await import("./config/firebaseAdmin.js");

      const snapshot = await db
        .collection("users")
        .where("status", "==", "pending")
        .limit(100)
        .get();

      const users = snapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          uid: doc.id,
          email: data.email || "",
          nickname: data.nickname || "",
          role: data.role || "member",
          status: data.status || "pending",
          inviteConsumed: data.inviteConsumed === true,
          createdAt: data.createdAt || null,
        };
      });

      return res.json({
        success: true,
        count: users.length,
        users,
      });
    } catch (error) {
      next(error);
    }
  }
);

// --------------------------------------------------
// 관리자: 회원 승인
// 승인과 동시에 가상 코인 1,000개 최초 지급
// --------------------------------------------------

app.post(
  "/api/admin/users/:uid/approve",
  authenticate,
  requireApproved,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { uid } = req.params;

      if (!uid || uid.includes("/")) {
        return res.status(400).json({
          success: false,
          message: "올바르지 않은 회원 UID입니다.",
        });
      }

      const { db } = await import("./config/firebaseAdmin.js");
      const userRef = db.collection("users").doc(uid);

      const snapshot = await userRef.get();

      if (!snapshot.exists) {
        return res.status(404).json({
          success: false,
          message: "해당 회원을 찾을 수 없습니다.",
        });
      }

      const user = snapshot.data();

      if (user.status === "suspended") {
        return res.status(400).json({
          success: false,
          message: "정지된 회원은 승인할 수 없습니다.",
        });
      }

      if (user.status === "approved") {
        return res.json({
          success: true,
          message: "이미 승인된 회원입니다.",
          alreadyApproved: true,
        });
      }

      await userRef.update({
        status: "approved",
        approvedAt: new Date().toISOString(),
        approvedBy: req.user.uid,
      });

      // 최초 승인 시에만 초기 코인을 지급하도록
      // initializeWallet 서비스에서 중복 지급을 방지해야 한다.
      await initializeWallet(uid, 1000);

      return res.json({
        success: true,
        message: "회원 승인 및 초기 코인 지급이 완료됐습니다.",
        uid,
        initialCoins: 1000,
      });
    } catch (error) {
      next(error);
    }
  }
);

// --------------------------------------------------
// 관리자: 대시보드 통계
// --------------------------------------------------

app.get(
  "/api/admin/stats",
  authenticate,
  requireApproved,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { db } = await import("./config/firebaseAdmin.js");

      const [
        usersSnapshot,
        pendingSnapshot,
        approvedSnapshot,
        webtoonsSnapshot,
        purchasesSnapshot,
      ] = await Promise.all([
        db.collection("users").get(),
        db.collection("users").where("status", "==", "pending").get(),
        db.collection("users").where("status", "==", "approved").get(),
        db.collection("webtoons").get(),
        db.collection("purchases").get(),
      ]);

      return res.json({
        success: true,
        stats: {
          totalUsers: usersSnapshot.size,
          pendingUsers: pendingSnapshot.size,
          approvedUsers: approvedSnapshot.size,
          totalWebtoons: webtoonsSnapshot.size,
          totalPurchases: purchasesSnapshot.size,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// --------------------------------------------------
// 존재하지 않는 API
// --------------------------------------------------

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "존재하지 않는 API 경로입니다.",
    path: req.originalUrl,
  });
});

// --------------------------------------------------
// 전역 오류 처리
// --------------------------------------------------

app.use((error, req, res, next) => {
  console.error("[API ERROR]", {
    method: req.method,
    path: req.originalUrl,
    message: error?.message || "Unknown error",
  });

  if (res.headersSent) {
    return next(error);
  }

  const statusCode = Number(error?.statusCode) || 500;

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "서버 내부 오류가 발생했습니다."
        : error.message || "요청을 처리할 수 없습니다.",
  });
});

export default app;
