/* Sandbox Mobile App download — sidebar ke "Download Sandbox Mobile APP" button
   ka config.

   APK file ko public/downloads/ folder me rakho (naam wahi jo FILE_NAME me hai).
   URL relative hai, is liye sandbox aur live dono par wahi file milegi jo
   usi host par deploy hui hai. Jab tak file nahi rakhi, button click par
   "abhi available nahi" ka toast dikhta hai (HTML fallback download nahi hota). */

export const MOBILE_APP_FILE_NAME = 'SchoolMentor-Sandbox.apk';
export const MOBILE_APP_DOWNLOAD_URL = `/downloads/${MOBILE_APP_FILE_NAME}`;
export const MOBILE_APP_BUTTON_LABEL = 'Sandbox Mobile app';
