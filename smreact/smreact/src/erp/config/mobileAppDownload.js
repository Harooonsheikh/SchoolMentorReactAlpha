/* Sandbox Mobile App download — sidebar ke "Sandbox Mobile app" button ka config.

   APK file public/downloads/ folder me rakho (koi bhi naam). File ka naam
   scripts/sync-mobile-app.js generate karta hai (mobileAppDownload.generated.js),
   is liye APK badlo to: node scripts/sync-mobile-app.js
   Folder me APK na ho to button click par "not available" toast dikhta hai. */

import { MOBILE_APP_FILE_NAME as GENERATED_FILE_NAME } from './mobileAppDownload.generated';

export const MOBILE_APP_FILE_NAME = GENERATED_FILE_NAME;
export const MOBILE_APP_DOWNLOAD_URL = MOBILE_APP_FILE_NAME
  ? `/downloads/${encodeURIComponent(MOBILE_APP_FILE_NAME)}`
  : null;
export const MOBILE_APP_BUTTON_LABEL = 'Sandbox Mobile app';
