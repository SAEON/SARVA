import { useEffect, useState } from "react";

export default function Overview() {
    const [health, setHealth] = useState(null);

    useEffect(() => {
        fetch("http://localhost:5050/api/health")
            .then(r => r.json())
            .then(setHealth)
            .catch(console.error);
    }, []);

    return (
        <div>
            <h1>SARVA</h1>
            <pre>{JSON.stringify(health, null, 2)}</pre>
        </div>
    );
}