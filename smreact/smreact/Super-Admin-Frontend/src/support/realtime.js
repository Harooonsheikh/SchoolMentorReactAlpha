/* ════════════════════════════════════════════════════════════════════
   SignalR connection wrapper for the Support hub (/hubs/support).
   - JWT passed via accessTokenFactory (server lifts it off the query string)
   - automatic reconnect
   - typed helpers for the hub methods (JoinSession / LeaveSession / Typing)
   ════════════════════════════════════════════════════════════════════ */
import {
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr';
import { supportHubUrl } from './config';

/* Server → client event names (mirror Application/Contracts/RealTime). */
export const Events = {
  MessageReceived: 'MessageReceived',
  MessageDelivered: 'MessageDelivered',
  MessageRead: 'MessageRead',
  TypingStarted: 'TypingStarted',
  TypingStopped: 'TypingStopped',
  SessionOpened: 'SessionOpened',
  SessionAssigned: 'SessionAssigned',
  SessionClosed: 'SessionClosed',
  UserConnected: 'UserConnected',
  UserDisconnected: 'UserDisconnected',
  PresenceChanged: 'PresenceChanged',
};

export function createConnection(getAccessToken) {
  return new HubConnectionBuilder()
    // Resolved per connection — the base only settles after login / init().
    .withUrl(supportHubUrl(), {
      accessTokenFactory: getAccessToken,
      // Allow SSE/long-polling fallback when WebSockets are blocked.
      transport:
        HttpTransportType.WebSockets |
        HttpTransportType.ServerSentEvents |
        HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 1000, 3000, 5000, 10000])
    .configureLogging(LogLevel.Warning)
    .build();
}

/* Hub method invokers (client → server). */
export const joinSession = (conn, sessionId) => conn.invoke('JoinSession', sessionId);
export const leaveSession = (conn, sessionId) => conn.invoke('LeaveSession', sessionId);
export const sendTyping = (conn, sessionId, isTyping) => conn.invoke('Typing', sessionId, isTyping);
