export async function readReviewResponse(response) {
    let body;
    try { body = await response.json(); }
    catch {
        const status = response.status;
        throw new Error(`The issue service returned an unexpected response (HTTP ${status}). Your change could not be confirmed. Refresh the issue before trying again.`);
    }
    if (!response.ok) throw new Error(body?.message || `Unable to complete the issue request (HTTP ${response.status}).`);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("The issue service returned an invalid response. Refresh the issue before trying again.");
    return body;
}
