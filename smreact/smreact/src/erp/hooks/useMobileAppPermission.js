import { useEffect, useState } from 'react';
import {
  emptyMobileAppPerms,
  listMobileAppPermission,
} from '../services/mobileAppPermissionService';

/* Super Admin ne school ke liye jo Chat / Mentor AI / eTube flags SAVE
   kiye, ERP unhe GET karke sidebar + screens par lagata hai. */
export default function useMobileAppPermission() {
  const [state, setState] = useState(() => ({
    ready: false,
    ...emptyMobileAppPerms(),
  }));

  useEffect(() => {
    const branchId = sessionStorage.getItem('branchID');
    if (!branchId) {
      setState((s) => ({ ...s, ready: true }));
      return undefined;
    }
    let alive = true;
    listMobileAppPermission(branchId)
      .then((perms) => { if (alive) setState({ ready: true, ...perms }); })
      .catch(() => { if (alive) setState({ ready: true, ...emptyMobileAppPerms() }); });
    return () => { alive = false; };
  }, []);

  return state;
}
