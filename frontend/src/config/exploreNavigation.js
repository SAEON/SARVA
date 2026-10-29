export function exploreNavigation(groups) {
    return groups.map(group => /^(community|partners & collaboration)$/i.test(String(group.label || "").trim())
        ? {...group, label:"Partners & Collaboration", to:"/partners", href:null, items:[]}
        : /^about$/i.test(String(group.label || "").trim())
        ? {...group, to:"/about", href:null, items:[]}
        : /^explore$/i.test(String(group.label || "").trim())
        ? {...group, to:"/explore", items:[]}
        : ({...group, items: (group.items || []).filter(item => {
        const path = String(item.to || item.href || "").split(/[?#]/)[0];
        return !path.endsWith("/municipal-planning-workspace")
            && !/ocean data explorer/i.test(item.label || "")
            && !path.includes("/apps/ocean/PELTER");
    }).map(item => {
        if (/^Partners$/i.test(item.label || ""))
            return {...item, label:"Partners & Collaborators", to:"/partners", href:null, external:false};
        if (/^(SARVA Atlas Gallery|Atlases, tools and links)$/i.test(item.label || ""))
            return {...item, label:"Atlases, tools and links", to:"/explore#atlas-tools", href:null, external:false};
        if (/^Terrestrial Observations? Monitor$/i.test(item.label || "") || /^SAEON Observations Monitor$/i.test(item.label || ""))
            return {...item, label:"SAEON Observations Monitor", to:null, href:"https://observationsmonitor.saeon.ac.za/home", external:true};
        if (item.label === "National Climate Change Information System")
            return {...item, to:null, href:"https://nccis.saeon.ac.za/", external:true};
        return item;
    })})).map(group => {
        if (/^maps & tools$/i.test(String(group.label || "").trim())) {
            const items = (group.items || []).filter(item =>
                !/^(Rainfall Risk Layers|National Climate Change Information System|Field Data System)$/i.test(String(item.label || "").trim())
                && !/^https:\/\/(?:nccis|fds)\.saeon\.ac\.za(?:\/|$)/i.test(item.href || ""));
            return {...group, items:[...items, {label:"Field Data System", href:"https://fds.saeon.ac.za/fds/", external:true}]};
        }
        if (!/^data$/i.test(String(group.label || "").trim())) return group;
        const items = (group.items || []).filter(item => !/^SAEON Observations Database$/i.test(item.label || "") && !/^https:\/\/observations\.saeon\.ac\.za(?:\/|$)/i.test(item.href || ""));
        const monitorIndex = items.findIndex(item => item.label === "SAEON Observations Monitor");
        items.splice(monitorIndex < 0 ? items.length : monitorIndex + 1, 0, {label:"SAEON Observations Database", href:"https://observations.saeon.ac.za/", external:true});
        return {...group, items};
    }).filter(group => !/^contact(?: sarva)?$/i.test(String(group.label || "").trim()))
        .flatMap(group => /^about$/i.test(String(group.label || "").trim())
            ? [group, {label:"Contact", to:"/contact", items:[]}]
            : [group]);
}
