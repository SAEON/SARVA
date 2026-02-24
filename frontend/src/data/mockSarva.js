export const sarva = {
    title: "SARVA",
    sections: [
        {
            slug: "climate-risk",
            title: "Climate Risk",
            summary: "Climate hazards, indicators, and tools.",
            blocks: [
                { type: "context", title: "Context", content: "Explain what this theme covers." },
                { type: "data", title: "Data", items: [
                        { label: "ODP dataset link", href: "https://example.org" },
                        { label: "ECVs mapping", href: "#" }
                    ]},
                { type: "tools", title: "Tools", items: [
                        { label: "Climate Risk Tool", href: "#" }
                    ]}
            ]
        },
        {
            slug: "biodiversity",
            title: "Biodiversity",
            summary: "EBVs, species, ecosystems, pressures.",
            blocks: [
                { type: "context", title: "Context", content: "Explain biodiversity relevance." },
                { type: "data", title: "Data", items: [] },
                { type: "tools", title: "Tools", items: [] }
            ]
        }
    ]
};