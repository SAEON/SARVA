import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import PageLoading from "./components/PageLoading.jsx";
import RouteError from "./components/RouteError.jsx";

import HomeLayout from "./layouts/HomeLayout.jsx";
import AppLayout from "./layouts/AppLayout.jsx";

import "./styles/tokens.css";

const Home = lazy(() => import("./pages/Home.jsx"));
const Explore = lazy(() => import("./pages/Explore.jsx"));
const Overview = lazy(() => import("./pages/Overview.jsx"));
const Theme = lazy(() => import("./pages/Theme.jsx"));
const Glossary = lazy(() => import("./pages/Glossary.jsx"));
const Resources = lazy(() => import("./pages/Resources.jsx"));
const NationalPolicy = lazy(() => import("./pages/NationalPolicy.jsx"));
const SearchRoute = lazy(() => import("./routes/SearchRoute.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const MunicipalRiskProfiler = lazy(() => import("./pages/MunicipalRiskProfiler.jsx"));
const MunicipalPlanningWorkspace = lazy(() => import("./pages/MunicipalPlanningWorkspace.jsx"));
const MdbBoundaryPreview = lazy(() => import("./pages/MdbBoundaryPreview.jsx"));

const router = createBrowserRouter([
    {
        element: <HomeLayout />,
        errorElement: <RouteError />,
        children: [
            {
                path: "/",
                element: (
                    <Suspense fallback={<PageLoading />}>
                        <Home />
                    </Suspense>
                ),
            },
        ],
    },
    {
        element: <AppLayout />,
        errorElement: <RouteError />,
        children: [
            {
                path: "/explore",
                element: (
                    <Suspense fallback={<PageLoading />}>
                        <Explore />
                    </Suspense>
                ),
            },
            {
                path: "/overview",
                element: (
                    <Suspense fallback={<PageLoading />}>
                        <Overview />
                    </Suspense>
                ),
            },
            {
                path: "/themes/:slug",
                element: (
                    <Suspense fallback={<PageLoading />}>
                        <Theme />
                    </Suspense>
                ),
            },
            {
                path: "/glossary",
                element: (
                    <Suspense fallback={<PageLoading />}>
                        <Glossary />
                    </Suspense>
                ),
            },
            {
                path: "/resources",
                element: (
                    <Suspense fallback={<PageLoading />}>
                        <Resources />
                    </Suspense>
                ),
            },
            {
                path: "/search",
                element: (
                    <Suspense fallback={<PageLoading />}>
                        <SearchRoute />
                    </Suspense>
                ),
            },
            {
                path: "/national-policy-and-legislation",
                element: (
                    <Suspense fallback={<PageLoading />}>
                        <NationalPolicy />
                    </Suspense>
                ),
            },
            {
                path: "/municipal-risk-profiler",
                element: (
                    <Suspense fallback={<PageLoading />}>
                        <MunicipalRiskProfiler />
                    </Suspense>
                ),
            },
            {
                path: "/municipal-planning-workspace",
                element: (
                    <Suspense fallback={<PageLoading />}>
                        <MunicipalPlanningWorkspace />
                    </Suspense>
                ),
            },
            {
                path: "/mdb-2026-boundaries",
                element: (
                    <Suspense fallback={<PageLoading />}>
                        <MdbBoundaryPreview />
                    </Suspense>
                ),
            },
            {
                path: "/about",
                element: (
                    <Suspense fallback={<PageLoading />}>
                        <About />
                    </Suspense>
                ),
            },
        ],
    },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);
