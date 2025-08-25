import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import moodRoutes from "./mood";
import itemRoutes from "./item";
import itemCompletionRoutes from "./itemCompletion";
import streakRoutes from "./streak";
import skipRoutes from "./skip";
import aiRoutes from "./ai";
import todayRoutes from "./today";
import communityRoutes from "./community";
import itemsRoutes from "./items";
import profileRoutes from "./profile";
import adminRoutes from "./admin";
import manualReviewRoutes from "./manual-review";
import insightsRoutes from "./insights";

import overdueRoutes from "./overdue";
import rewardsRoutes from "./rewards";
import recurringRoutes from "./recurring";
import phase5SharingRoutes from "./phase5-sharing";

const router = Router();

// Public health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "MindDouble API is running" });
});

// Protected routes - apply authentication middleware to all API endpoints
router.use("/api", authMiddleware);

// Register route modules
router.use("/api/mood", moodRoutes);
router.use("/api/items", itemsRoutes);
router.use("/api/item", itemRoutes);
router.use("/api/item", itemCompletionRoutes);
router.use("/api/item", streakRoutes);
router.use("/api/streak", streakRoutes);
router.use("/api/item", skipRoutes);
router.use("/api/ai", aiRoutes);
router.use("/api/today", todayRoutes);
router.use("/api/community", communityRoutes);
router.use("/api/communities", communityRoutes);
router.use("/api/profile", profileRoutes);
router.use("/api/admin", adminRoutes);
router.use("/api/manual-review", manualReviewRoutes);
router.use("/api/insights", insightsRoutes);
router.use("/api/overdue", overdueRoutes);
router.use("/api/rewards", rewardsRoutes);
router.use("/api/recurring", recurringRoutes);
router.use("/api/phase5", phase5SharingRoutes);

export default router;
