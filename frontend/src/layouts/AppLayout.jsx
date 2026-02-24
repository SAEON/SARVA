// src/layouts/AppLayout.jsx
import { Outlet } from "react-router-dom";
import Header from "../components/Header.jsx";
import "../styles/layout.css";

export default function AppLayout() {
    return (
        <>
            <Header />

            <main className="sarva-page">
                <Outlet />
            </main>
        </>
    );
}