import { useEffect, useState } from 'react';
import * as techTicketsApi from '../api/services/techTickets';

/* Developer dropdown list — the server's active users (README §7 ?action=users).
   Value = server user id; the service accepts it as assignedToUserId. */
export default function useTechDevelopers() {
  const [devs, setDevs] = useState([]);
  useEffect(() => {
    let alive = true;
    techTicketsApi.getTechUsers().then((rows) => { if (alive) setDevs(rows); }).catch(() => { if (alive) setDevs([]); });
    return () => { alive = false; };
  }, []);
  return devs;
}
