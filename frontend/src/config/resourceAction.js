export function resourceActionLabel(item = {}) {
    let path = "";
    try { path = decodeURIComponent(new URL(item.url, "https://sarva.saeon.ac.za").pathname); } catch { /* Unknown links remain source pages. */ }
    if (/\.pdf$/i.test(path)) return "Download PDF";
    if (/\.(?:docx?|xlsx?|pptx?|csv|tsv|zip|gz|7z|ipynb|epub)$/i.test(path)) return "Download file";
    if (/red book/i.test(item.title || "") && /neighbourhood planning|design guide/i.test(item.title || "")) return "Download";
    return "Visit source";
}
