import { NavLink, Outlet } from "react-router-dom";
import { sarva } from "../data/mockSarva";

export default function Layout() {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: "100vh" }}>
            <aside style={{ borderRight: "1px solid #eee", padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>{sarva.title}</div>
                <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <NavLink to="/" end style={({ isActive }) => ({ color: isActive ? "black" : "#555" })}>
                        Overview
                    </NavLink>
                    {sarva.sections.map((s) => (
                        <NavLink
                            key={s.slug}
                            to={`/themes/${s.slug}`}
                            style={({ isActive }) => ({ color: isActive ? "black" : "#555" })}
                        >
                            {s.title}
                        </NavLink>
                    ))}
                </nav>
            </aside>

            <main style={{ padding: 24 }}>
                <Outlet />
            </main>
        </div>
    );
}