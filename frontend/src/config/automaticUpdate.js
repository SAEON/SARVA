export function shouldReload({current,latest,hidden,dirty,busy,idleMs,attempted}) {
    return typeof latest === 'string' && /^[a-f0-9-]{36}$/.test(latest)
        && latest !== current && !hidden && !dirty && !busy && idleMs >= 15000 && latest !== attempted;
}

export function watchAutomaticUpdate({win,doc,current,fetchVersion,now=Date.now}) {
    let stopped=false,latest=null,lastActivity=now(),controller;
    const original=new WeakMap(),changed=new Set();
    const editable=node=>node?.matches?.('input:not([type=hidden]):not([type=submit]):not([type=button]),textarea,select,[contenteditable="true"]');
    const value=node=>node.type==='checkbox'||node.type==='radio'?String(node.checked):node.type==='file'?String(node.files?.length || 0):node.isContentEditable?node.textContent:node.value;
    function focus(event){if(editable(event.target)&&!original.has(event.target))original.set(event.target,value(event.target));}
    function input(event){const node=event.target;if(!editable(node))return;changed.add(node);lastActivity=now();}
    function activity(){lastActivity=now();}
    function dirty(){
        for(const node of changed){if(!node.isConnected || (original.has(node)&&value(node)===original.get(node)))changed.delete(node);}
        return changed.size>0 || [...doc.querySelectorAll('input[type="password"],input[type="file"]')].some(node=>Boolean(node.value));
    }
    function check(){
        if(stopped)return;
        let attempted;
        try{attempted=win.sessionStorage.getItem('sarva-auto-update');}catch{return;}
        const busy=Boolean(doc.querySelector('[aria-busy="true"],form fieldset:disabled'));
        if(shouldReload({current,latest,hidden:doc.hidden,dirty:dirty(),busy,idleMs:now()-lastActivity,attempted})){
            try{win.sessionStorage.setItem('sarva-auto-update',latest);}catch{return;}
            win.location.reload();
        }
    }
    async function poll(){
        if(stopped||doc.hidden)return;
        controller?.abort();controller=new AbortController();
        try{const response=await fetchVersion('/version.json',{cache:'no-store',credentials:'omit',signal:controller.signal});
            if(response.ok){const body=await response.json();if(!stopped)latest=body?.version;}
        }catch{/* A failed check leaves the current page alone. */}
        check();
    }
    function visible(){if(!doc.hidden){lastActivity=now();poll();}}
    doc.addEventListener('focusin',focus);doc.addEventListener('input',input);doc.addEventListener('change',input);
    doc.addEventListener('pointerdown',activity);doc.addEventListener('keydown',activity);doc.addEventListener('visibilitychange',visible);
    const pollTimer=win.setInterval(poll,60000),idleTimer=win.setInterval(check,5000);
    poll();
    return ()=>{stopped=true;controller?.abort();win.clearInterval(pollTimer);win.clearInterval(idleTimer);
        doc.removeEventListener('focusin',focus);doc.removeEventListener('input',input);doc.removeEventListener('change',input);
        doc.removeEventListener('pointerdown',activity);doc.removeEventListener('keydown',activity);doc.removeEventListener('visibilitychange',visible);
    };
}
