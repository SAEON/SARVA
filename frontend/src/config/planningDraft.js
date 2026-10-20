export function normalizeDraft(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a workspace object.');
    for (const key of ['municipality', 'municipalityCode']) {
        if (value[key] != null && typeof value[key] !== 'string') throw new Error(`Invalid ${key}.`);
    }
    const collections = {};
    for (const [key, title] of [['evidence','title'],['priorities','title'],['actions','action']]) {
        if (!Array.isArray(value[key])) throw new Error(`Missing ${key} list.`);
        const ids = new Set();
        collections[key] = value[key].map(row => {
            if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id || ids.has(row.id) || typeof row[title] !== 'string') throw new Error(`Invalid or duplicate ${key} record.`);
            ids.add(row.id);
            for (const [field, content] of Object.entries(row)) {
                if (field === 'evidenceIds') {
                    if (!Array.isArray(content) || content.some(id => typeof id !== 'string')) throw new Error('Invalid evidence links.');
                } else if (typeof content !== 'string') throw new Error(`Invalid ${key} field ${field}.`);
            }
            return {...row};
        });
    }
    const evidenceIds = new Set(collections.evidence.map(r => r.id));
    collections.priorities = collections.priorities.map(row => ({...row, evidenceIds: row.evidenceIds || []}));
    if (collections.priorities.some(row => row.evidenceIds.some(id => !evidenceIds.has(id)))) throw new Error('A priority links to missing evidence.');
    collections.actions = collections.actions.map(row => {
        const matches = collections.priorities.filter(p => p.title === row.priority);
        const priorityId = row.priorityId || (matches.length === 1 ? matches[0].id : '');
        if (priorityId && !collections.priorities.some(p => p.id === priorityId)) throw new Error('An action links to a missing priority.');
        return {...row, priorityId};
    });
    return {municipality: value.municipality || '', municipalityCode: value.municipalityCode || '', ...collections, updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString()};
}
