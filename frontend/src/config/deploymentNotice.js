export function deploymentInProgress(status, now = Date.now()) {
    if (status?.active !== true) return false;
    const started = Date.parse(status.startedAt), expires = Date.parse(status.expiresAt);
    return Number.isFinite(started) && Number.isFinite(expires)
        && started <= now && expires > now && expires - started <= 45 * 60 * 1000;
}
