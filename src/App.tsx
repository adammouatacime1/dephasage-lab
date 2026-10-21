import { useState } from 'react';
import { Moon, Sun, Power, X } from 'lucide-react';
import { Button, IconButton, LabHeader, LabRoot, type LabTheme } from './shared/lab-ui';
import { DephasageLaboratory } from './laboratories/dephasage/DephasageLaboratory';
import './host.css';
export default function App() {
  const [theme,setTheme] = useState<LabTheme>('light'), [opened,setOpened] = useState(true), [active,setActive] = useState(true);
  return <LabRoot theme={theme} className="phase-lab-host">
    <LabHeader title="Phase Lab" subtitle="LE LABORATOIRE DU DÉPHASAGE" badge="ONDES & SIGNAUX" actions={<>
      {opened&&<><IconButton label={active?'Suspendre le laboratoire':'Réactiver le laboratoire'} active={!active} onClick={()=>setActive(v=>!v)}><Power size={17}/></IconButton><IconButton label="Fermer le laboratoire" onClick={()=>setOpened(false)}><X size={17}/></IconButton></>}
      <IconButton label={theme==='light'?'Activer le thème sombre':'Activer le thème clair'} onClick={()=>setTheme(v=>v==='light'?'dark':'light')}>{theme==='light'?<Moon size={17}/>:<Sun size={17}/>}</IconButton>
    </>}/>
    {opened?<DephasageLaboratory theme={theme} active={active}/>:<main className="phase-host-closed"><span className="lk-eyebrow">VOTRE ESPACE D’EXPÉRIMENTATION</span><h1>Le laboratoire est fermé.</h1><p>Ses animations et ses calculs sont arrêtés. Retrouvez l’expérience quand vous le souhaitez.</p><Button primary onClick={()=>{setActive(true);setOpened(true);}}>Ouvrir le laboratoire de déphasage</Button></main>}
  </LabRoot>;
}
