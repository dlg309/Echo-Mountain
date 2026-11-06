import React, {useEffect, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import page from '../dist/index.html?raw';
import '../dist/style.css';

// Use one shared interface for the Vite and buildless Python entry points.
// The existing game owns the mounted canvas and controls after React places them.
const template=new DOMParser().parseFromString(page,'text/html');
template.body.querySelectorAll('script').forEach(script=>script.remove());
const markup=template.body.innerHTML;

function Game(){
  const error=useRef(null);
  useEffect(()=>{
    import('../dist/game.mjs').catch(reason=>{
      console.error('Unable to start Echo Mountain',reason);
      if(error.current){error.current.hidden=false;error.current.textContent='The game could not start. Please reload the page.'}
    });
  },[]);
  return <><div className="game-root" dangerouslySetInnerHTML={{__html:markup}}/><p ref={error} role="alert" hidden /></>;
}

createRoot(document.getElementById('root')).render(<Game/>);
