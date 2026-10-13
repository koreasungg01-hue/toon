import { Router } from "express";
import { db } from "../config/firebaseAdmin.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireApproved } from "../middleware/requireApproved.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

const adminOnly = [authenticate, requireApproved, requireAdmin];

function cleanText(value, maxLength = 200) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function validId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 100 &&
    !value.includes("/")
  );
}

function toWebtoon(id, data) {
  return {
    id,
    title: data.title || "",
    description: data.description || "",
    author: data.author || "",
    coverUrl: data.coverUrl || "",
    genre: data.genre || "",
    status: data.status || "draft",
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

// 공개 작품 목록
router.get("/", authenticate, requireApproved, async (req, res, next) => {
  try {
    const snapshot = await db
      .collection("webtoons")
      .where("status", "==", "published")
      .limit(100)
      .get();

    const webtoons = snapshot.docs.map((doc) =>
      toWebtoon(doc.id, doc.data())
    );

    res.json({ success: true, webtoons });
  } catch (error) {
    next(error);
  }
});

// 작품 상세 및 회차 목록
router.get("/:id", authenticate, requireApproved, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "잘못된 작품 ID다.",
      });
    }

    const snapshot = await db.collection("webtoons").doc(id).get();

    if (!snapshot.exists) {
      return res.status(404).json({
        success: false,
        message: "작품을 찾을 수 없다.",
      });
    }

    const data = snapshot.data();
    const isAdmin = process.env.ADMIN_UIDS
      ?.split(",")
      .map((uid) => uid.trim())
      .includes(req.user.uid);

    if (data.status !== "published" && !isAdmin) {
      return res.status(404).json({
        success: false,
        message: "작품을 찾을 수 없다.",
      });
    }

    const episodesSnapshot = await db
      .collection("webtoons")
      .doc(id)
      .collection("episodes")
      .orderBy("episodeNumber", "asc")
      .limit(200)
      .get();

    const episodes = episodesSnapshot.docs
      .filter((episode) => {
        return isAdmin || episode.data().status === "published";
      })
      .map((episode) => {
        const episodeData = episode.data();

        return {
          id: episode.id,
          title: episodeData.title || "",
          episodeNumber: episodeData.episodeNumber || 0,
          price: episodeData.price || 0,
          status: episodeData.status || "draft",
          createdAt: episodeData.createdAt || null,
        };
      });

    res.json({
      success: true,
      webtoon: toWebtoon(snapshot.id, data),
      episodes,
    });
  } catch (error) {
    next(error);
  }
});

// 관리자: 작품 등록
router.post("/", ...adminOnly, async (req, res, next) => {
  try {
    const title = cleanText(req.body.title, 100);
    const description = cleanText(req.body.description, 3000);
    const author = cleanText(req.body.author, 100);
    const coverUrl = cleanText(req.body.coverUrl, 2000);
    const genre = cleanText(req.body.genre, 50);

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "작품 제목을 입력해라.",
      });
    }

    const now = new Date().toISOString();

    const ref = await db.collection("webtoons").add({
      title,
      description,
      author,
      coverUrl,
      genre,
      status: "draft",
      createdBy: req.user.uid,
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).json({
      success: true,
      message: "작품을 등록했다.",
      webtoon: {
        id: ref.id,
        title,
        description,
        author,
        coverUrl,
        genre,
        status: "draft",
      },
    });
  } catch (error) {
    next(error);
  }
});

// 관리자: 작품 수정 및 공개 상태 변경
router.patch("/:id", ...adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "잘못된 작품 ID다.",
      });
    }

    const ref = db.collection("webtoons").doc(id);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return res.status(404).json({
        success: false,
        message: "작품이 없다.",
      });
    }

    const updates = {};
    const body = req.body || {};

    for (const key of ["title", "description", "author", "coverUrl", "genre"]) {
      if (body[key] !== undefined) {
        const limits = {
          title: 100,
          description: 3000,
          author: 100,
          coverUrl: 2000,
          genre: 50,
        };

        if (typeof body[key] !== "string") {
          return res.status(400).json({
            success: false,
            message: `${key} 값은 문자열이어야 한다.`,
          });
        }

        updates[key] = cleanText(body[key], limits[key]);
      }
    }

    if (body.status !== undefined) {
      if (!["draft", "published", "archived"].includes(body.status)) {
        return res.status(400).json({
          success: false,
          message: "상태는 draft, published, archived 중 하나여야 한다.",
        });
      }

      updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "수정할 항목이 없다.",
      });
    }

    updates.updatedAt = new Date().toISOString();
    await ref.update(updates);

    res.json({
      success: true,
      message: "작품을 수정했다.",
      updates,
    });
  } catch (error) {
    next(error);
  }
});

// 관리자: 작품 삭제
router.delete("/:id", ...adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "잘못된 작품 ID다.",
      });
    }

    const ref = db.collection("webtoons").doc(id);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return res.status(404).json({
        success: false,
        message: "작품이 없다.",
      });
    }

    // 구매 기록이 존재하면 기록 보존을 위해 삭제 대신 보관 처리한다.
    const purchases = await db
      .collection("purchases")
      .where("webtoonId", "==", id)
      .limit(1)
      .get();

    if (!purchases.empty) {
      await ref.update({
        status: "archived",
        updatedAt: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: "구매 기록이 있어 작품을 보관 처리했다.",
      });
    }

    // Firestore 하위 컬렉션은 부모 문서 삭제만으로 지워지지 않는다.
    const episodes = await ref.collection("episodes").get();
    const batch = db.batch();

    for (const episode of episodes.docs) {
      batch.delete(episode.ref);
    }

    batch.delete(ref);
    await batch.commit();

    res.json({
      success: true,
      message: "작품과 회차를 삭제했다.",
    });
  } catch (error) {
    next(error);
  }
});

// 관리자: 회차 등록
router.post("/:id/episodes", ...adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "잘못된 작품 ID다.",
      });
    }

    const webtoonRef = db.collection("webtoons").doc(id);
    const webtoon = await webtoonRef.get();

    if (!webtoon.exists) {
      return res.status(404).json({
        success: false,
        message: "작품을 찾을 수 없다.",
      });
    }

    const title = cleanText(req.body.title, 150);
    const episodeNumber = Number(req.body.episodeNumber);
    const price = Number(req.body.price);
    const imageUrls = req.body.imageUrls;

    if (
      !title ||
      !Number.isSafeInteger(episodeNumber) ||
      episodeNumber < 1 ||
      !Number.isSafeInteger(price) ||
      price < 0 ||
      price > 1000000 ||
      !Array.isArray(imageUrls) ||
      imageUrls.length < 1 ||
      imageUrls.length > 300 ||
      imageUrls.some(
        (url) =>
          typeof url !== "string" ||
          url.length > 2000 ||
          !url.startsWith("https://")
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "제목, 회차 번호, 가격 또는 HTTPS 이미지 주소 목록을 확인해라.",
      });
    }

    const duplicate = await webtoonRef
      .collection("episodes")
      .where("episodeNumber", "==", episodeNumber)
      .limit(1)
      .get();

    if (!duplicate.empty) {
      return res.status(409).json({
        success: false,
        message: "이미 등록된 회차 번호다.",
      });
    }

    const now = new Date().toISOString();

    const episodeRef = await webtoonRef.collection("episodes").add({
      title,
      episodeNumber,
      price,
      imageUrls,
      status: "draft",
      createdBy: req.user.uid,
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).json({
      success: true,
      message: "회차를 등록했다. 공개 전에는 독자에게 표시되지 않는다.",
      episode: {
        id: episodeRef.id,
        title,
        episodeNumber,
        price,
        status: "draft",
      },
    });
  } catch (error) {
    next(error);
  }
});

// 관리자: 회차 수정 및 공개
router.patch(
  "/:id/episodes/:episodeId",
  ...adminOnly,
  async (req, res, next) => {
    try {
      const { id, episodeId } = req.params;

      if (!validId(id) || !validId(episodeId)) {
        return res.status(400).json({
          success: false,
          message: "잘못된 작품 또는 회차 ID다.",
        });
      }

      const ref = db
        .collection("webtoons")
        .doc(id)
        .collection("episodes")
        .doc(episodeId);

      const snapshot = await ref.get();

      if (!snapshot.exists) {
        return res.status(404).json({
          success: false,
          message: "회차가 없다.",
        });
      }

      const updates = {};
      const body = req.body || {};

      if (body.title !== undefined) {
        if (typeof body.title !== "string" || !body.title.trim()) {
          return res.status(400).json({
            success: false,
            message: "회차 제목을 확인해라.",
          });
        }

        updates.title = cleanText(body.title, 150);
      }

      for (const key of ["episodeNumber", "price"]) {
        if (body[key] !== undefined) {
          const value = Number(body[key]);

          if (
            !Number.isSafeInteger(value) ||
            value < (key === "episodeNumber" ? 1 : 0) ||
            value > (key === "price" ? 1000000 : 100000)
          ) {
            return res.status(400).json({
              success: false,
              message: `${key} 값이 올바르지 않다.`,
            });
          }

          updates[key] = value;
        }
      }

      if (body.imageUrls !== undefined) {
        if (
          !Array.isArray(body.imageUrls) ||
          body.imageUrls.length < 1 ||
          body.imageUrls.length > 300 ||
          body.imageUrls.some(
            (url) =>
              typeof url !== "string" ||
              url.length > 2000 ||
              !url.startsWith("https://")
          )
        ) {
          return res.status(400).json({
            success: false,
            message: "이미지 주소 목록을 확인해라.",
          });
        }

        updates.imageUrls = body.imageUrls;
      }

      if (body.status !== undefined) {
        if (!["draft", "published", "archived"].includes(body.status)) {
          return res.status(400).json({
            success: false,
            message: "잘못된 회차 상태다.",
          });
        }

        updates.status = body.status;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: "수정할 항목이 없다.",
        });
      }

      updates.updatedAt = new Date().toISOString();
      await ref.update(updates);

      res.json({
        success: true,
        message: "회차를 수정했다.",
        updates,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 관리자: 회차 삭제
router.delete(
  "/:id/episodes/:episodeId",
  ...adminOnly,
  async (req, res, next) => {
    try {
      const { id, episodeId } = req.params;

      if (!validId(id) || !validId(episodeId)) {
        return res.status(400).json({
          success: false,
          message: "잘못된 ID다.",
        });
      }

      const purchases = await db
        .collection("purchases")
        .where("webtoonId", "==", id)
        .where("episodeId", "==", episodeId)
        .limit(1)
        .get();

      const ref = db
        .collection("webtoons")
        .doc(id)
        .collection("episodes")
        .doc(episodeId);

      const snapshot = await ref.get();

      if (!snapshot.exists) {
        return res.status(404).json({
          success: false,
          message: "회차가 없다.",
        });
      }

      if (!purchases.empty) {
        await ref.update({
          status: "archived",
          updatedAt: new Date().toISOString(),
        });

        return res.json({
          success: true,
          message: "구매 기록이 있어 회차를 보관 처리했다.",
        });
      }

      await ref.delete();

      res.json({
        success: true,
        message: "회차를 삭제했다.",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
