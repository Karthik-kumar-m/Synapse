import React from "react";
import { createBrowserRouter } from "react-router";
import { RootLayout } from "./RootLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ReviewsPage } from "./pages/ReviewsPage";
import { InsightsPage } from "./pages/InsightsPage";
import { IngestPage } from "./pages/IngestPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: DashboardPage },
      { path: "reviews", Component: ReviewsPage },
      { path: "insights", Component: InsightsPage },
      { path: "ingest", Component: IngestPage },
    ],
  },
]);
