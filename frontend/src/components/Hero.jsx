import { useEffect } from "react";
import { apiUrl } from "../config/api";
import { useJsonResource } from "../hooks/useJsonResource";
import "../styles/hero.css";

export default function Hero() {
    const { data: heroResponse, error } = useJsonResource("/api/site/hero", { cache: true });
    const hero = heroResponse?.status === "ok" ? heroResponse.data : null;

    useEffect(() => {
        if (error) console.error("Hero load error:", error);
    }, [error]);

    if (!hero) return null;

    const imageUrl = apiUrl(hero.image_path);

    return (
        <section
            className="sarva-hero"
            style={{
                backgroundImage: `url(${imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center"
            }}
        >
            <div className="sarva-hero__overlay" />
            <div className="sarva-hero__content">
                {hero.subtitle && (
                    <div className="sarva-hero__kicker">{hero.subtitle}</div>
                )}

                <h1 className="sarva-hero__title">{hero.title}</h1>

                {hero.description && (
                    <p className="sarva-hero__body">{hero.description}</p>
                )}

                {hero.cta_label && (
                    <a href={hero.cta_href} className="sarva-hero__cta">
                        {hero.cta_label}
                    </a>
                )}
            </div>
        </section>
    );
}
