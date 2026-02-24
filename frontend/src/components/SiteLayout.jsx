import { Outlet } from "react-router-dom";
import Header from "./Header.jsx";
import "../styles/layout.css";

export default function SiteLayout() {
    return (
        <>
            <Header />
            <main className="sarva-page">
                <Outlet />
            </main>
        </>
    );
}