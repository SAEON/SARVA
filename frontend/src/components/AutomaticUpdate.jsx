/* global __SARVA_BUILD_ID__ */
import {useEffect} from 'react';
import {watchAutomaticUpdate} from '../config/automaticUpdate';
export default function AutomaticUpdate(){
    useEffect(()=>watchAutomaticUpdate({win:window,doc:document,current:__SARVA_BUILD_ID__,fetchVersion:window.fetch.bind(window)}),[]);
    return null;
}
