import { useEffect } from 'react';
import {
  startUserTimeSpend,
  stopUserTimeSpend,
  installUserTimeSpendListeners,
} from '../services/userTimeSpendService';

/*
  useUserTimeSpend — jis screen/module par user hai uska time
  POST /manage-usertimespend par bhejta hai (type: "erp").

  `screenName` badle to pehli screen close + nayi start.
  Unmount / tab close / logout par last screen flush.
*/
export default function useUserTimeSpend(screenName) {
  useEffect(() => installUserTimeSpendListeners(), []);

  useEffect(() => {
    startUserTimeSpend(screenName);
    return () => { stopUserTimeSpend(); };
  }, [screenName]);
}
