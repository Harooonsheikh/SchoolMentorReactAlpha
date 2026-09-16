import { useEffect, useState } from 'react';
import { cachedChainBranch, checkChainBranch } from '../services/chainBranch';

/* Ye school kisi network (chain) ka hissa hai ya nahi.
   Jawab sessionStorage me sambhal liya jata hai (dekhein services/chainBranch),
   is liye refresh par foran maloom hota hai aur network call ka intezar nahi
   hota — sirf pehli dafa `ready` false rehta hai. */
export default function useChainBranch() {
  const [state, setState] = useState(() => {
    const cached = cachedChainBranch();
    return cached == null
      ? { ready: false, inNetwork: false }
      : { ready: true, inNetwork: cached === '1' };
  });

  useEffect(() => {
    if (state.ready) return undefined;
    let alive = true;
    checkChainBranch()
      .then((yes) => { if (alive) setState({ ready: true, inNetwork: yes }); })
      .catch(() => { if (alive) setState({ ready: true, inNetwork: false }); });
    return () => { alive = false; };
  }, [state.ready]);

  return state;
}
