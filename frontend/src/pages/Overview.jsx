import { useEffect } from "react";
import { useJsonResource } from "../hooks/useJsonResource";

export default function Overview() {
    const { data: health, error } = useJsonResource("/api/health");

    useEffect(() => {
        if (error) console.error(error);
    }, [error]);

    return (
        <div>
            <h1>SARVA</h1>
            <pre>{JSON.stringify(health, null, 2)}</pre>
        </div>
    );
}
