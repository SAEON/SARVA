import { useEffect, useState } from "react";
import "../styles/hero.css";

export default function Hero() {
    const [hero, setHero] = useState(null);

    useEffect(() => {
        fetch("http://localhost:5050/api/site/hero")
            .then((res) => res.json())
            .then((data) => {
                if (data.status === "ok") {
                    setHero(data.data);
                }
            })
            .catch((err) => {
                console.error("Hero load error:", err);
            });
    }, []);

    if (!hero) return null;

    const imageUrl = `http://localhost:5050${hero.image_path}`;

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