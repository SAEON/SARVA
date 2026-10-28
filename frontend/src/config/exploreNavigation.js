export function exploreNavigation(groups) {
    return groups.map(group => /^explore$/i.test(String(group.label || "").trim())
        ? {...group, to:"/explore", items:[]}
        : ({...group, items: (group.items || []).filter(item => {
        const path = String(item.to || item.href || "").split(/[?#]/)[0];
        return !path.endsWith("/municipal-planning-workspace")
            && !/ocean data explorer/i.test(item.label || "")
            && !path.includes("/apps/ocean/PELTER");
    }).map(item => {
        if (/^(SARVA Atlas Gallery|Atlases, tools and links)$/i.test(item.label || ""))
            return {...item, label:"Atlases, tools and links", to:"/explore#atlas-tools", href:null, external:false};
        if (item.label === "National Climate Change Information System")
            return {...item, to:null, href:"https://nccis.saeon.ac.za/", external:true};
        return item;
    })}));
}
