/* global __SARVA_BUILD_ID__ */
import {useEffect,useState} from 'react';
import {watchAutomaticUpdate} from '../config/automaticUpdate';
import '../styles/automatic-update.css';
export default function AutomaticUpdate(){
    const [available,setAvailable]=useState(false);
    useEffect(()=>watchAutomaticUpdate({win:window,doc:document,current:__SARVA_BUILD_ID__,fetchVersion:window.fetch.bind(window),onAvailable:()=>setAvailable(true)}),[]);
    return <div className="sarva-update" aria-label="Website updates">
        {available&&<strong role="status">New SARVA update available</strong>}
        <button type="button" onClick={()=>window.location.reload()}>Refresh to see new updates <span aria-hidden="true">↻</span></button>
    </div>;
}
