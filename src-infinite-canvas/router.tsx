import { createHashRouter, Outlet } from "react-router-dom";

import { AnalyticsTracker } from "@infinite/components/layout/analytics-tracker";
import UserLayout from "@infinite/layouts/user-layout";
import AssetsPage from "@infinite/pages/assets";
import CanvasPage from "@infinite/pages/canvas";
import CanvasProjectPage from "@infinite/pages/canvas/project";
import ConfigPage from "@infinite/pages/config";
import HomePage from "@infinite/pages/home";
import ImagePage from "@infinite/pages/image";
import NotFound from "@infinite/pages/not-found";
import PromptsPage from "@infinite/pages/prompts";
import VideoPage from "@infinite/pages/video";

// 复刻工作台运行在独立 HTML 入口中。Hash 路由让项目、素材、提示词与
// 配置页始终留在隔离入口内，不会和 CanvasMind 自身的 Vue 路由冲突。
export const router = createHashRouter([
    {
        element: (
            <UserLayout>
                <AnalyticsTracker />
                <Outlet />
            </UserLayout>
        ),
        children: [
            { path: "/", element: <HomePage /> },
            { path: "/image", element: <ImagePage /> },
            { path: "/video", element: <VideoPage /> },
            { path: "/assets", element: <AssetsPage /> },
            { path: "/prompts", element: <PromptsPage /> },
            { path: "/canvas", element: <CanvasPage /> },
            { path: "/canvas/:id", element: <CanvasProjectPage /> },
            { path: "/config", element: <ConfigPage /> },
        ],
    },
    { path: "*", element: <NotFound /> },
]);
