Sandbox Mobile App APK folder.

Put the app file (.apk) here with any file name.

After adding or replacing the APK, run this from the project root:

    node scripts/sync-mobile-app.js

It picks the newest .apk in this folder and writes its name to
src/erp/config/mobileAppDownload.generated.js. The sidebar button
"Sandbox Mobile app" then downloads that file.
