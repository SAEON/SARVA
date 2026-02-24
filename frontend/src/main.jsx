import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import HomeLayout from "./layouts/HomeLayout.jsx";
import AppLayout from "./layouts/AppLayout.jsx";

import Home from "./pages/Home.jsx";
import Overview from "./pages/Overview.jsx";
import Theme from "./pages/Theme.jsx";
import Glossary from "./pages/Glossary.jsx";

import "./styles/tokens.css";

const router = createBrowserRouter([
    // Home: full bleed
    {
        element: <HomeLayout />,
        children: [{ path: "/", element: <Home /> }],
    },

    // App pages: header + sidebar layout
    {
        element: <AppLayout />,
        children: [
            { path: "/overview", element: <Overview /> },
            { path: "/themes/:slug", element: <Theme /> },
            { path: "/glossary", element: <Glossary /> }, // ✅ FIX: add leading "/"
        ],
    },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);