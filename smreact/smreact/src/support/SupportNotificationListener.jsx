import { useEffect } from "react";
import { 
  showSupportNotification, 
  requestNotificationPermission 
} from "./notification";

export default function SupportNotificationListener() {

  useEffect(() => {

    requestNotificationPermission();

    // SignalR listener will be added here

  }, []);

  return null;
}