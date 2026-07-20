import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import HomeLayout from "./layouts/HomeLayout.jsx";
import AppLayout from "./layouts/AppLayout.jsx";

import "./styles/tokens.css";

const Home = lazy(() => import("./pages/Home.jsx"));
const Overview = lazy(() => import("./pages/Overview.jsx"));
const Theme = lazy(() => import("./pages/Theme.jsx"));
const Glossary = lazy(() => import("./pages/Glossary.jsx"));
const Resources = lazy(() => import("./pages/Resources.jsx"));
const NationalPolicy = lazy(() => import("./pages/NationalPolicy.jsx"));
const SearchRoute = lazy(() => import("./routes/SearchRoute.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const MunicipalRiskProfiler = lazy(() => import("./pages/MunicipalRiskProfiler.jsx"));

const router = createBrowserRouter([
    {
        element: <HomeLayout />,
        children: [
            {
                path: "/",
                element: (
                    <Suspense fallback={null}>
                        <Home />
                    </Suspense>
                ),
            },
        ],
    },
    {
        element: <AppLayout />,
        children: [
            {
                path: "/overview",
                element: (
                    <Suspense fallback={null}>
                        <Overview />
                    </Suspense>
                ),
            },
            {
                path: "/themes/:slug",
                element: (
                    <Suspense fallback={null}>
                        <Theme />
                    </Suspense>
                ),
            },
            {
                path: "/glossary",
                element: (
                    <Suspense fallback={null}>
                        <Glossary />
                    </Suspense>
                ),
            },
            {
                path: "/resources",
                element: (
                    <Suspense fallback={null}>
                        <Resources />
                    </Suspense>
                ),
            },
            {
                path: "/search",
                element: (
                    <Suspense fallback={null}>
                        <SearchRoute />
                    </Suspense>
                ),
            },
            {
                path: "/national-policy-and-legislation",
                element: (
                    <Suspense fallback={null}>
                        <NationalPolicy />
                    </Suspense>
                ),
            },
            {
                path: "/municipal-risk-profiler",
                element: (
                    <Suspense fallback={null}>
                        <MunicipalRiskProfiler />
                    </Suspense>
                ),
            },
            {
                path: "/about",
                element: (
                    <Suspense fallback={null}>
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
