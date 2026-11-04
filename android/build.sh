#!/usr/bin/env bash
# Сборка APK без Gradle: aapt2 -> javac -> d8 -> zip -> zipalign -> apksigner
# Нужны: JDK 17, Android SDK (platforms;android-34, build-tools;34.0.0)
set -euo pipefail
: "${ANDROID_HOME:?укажите ANDROID_HOME}"
BT="$ANDROID_HOME/build-tools/34.0.0"; AJ="$ANDROID_HOME/platforms/android-34/android.jar"
KS="${KEYSTORE:-keystore.jks}"; KSPASS="${KEYSTORE_PASS:?укажите KEYSTORE_PASS}"
rm -rf build && mkdir -p build/gen build/classes build/dex
"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/unsigned.apk -I "$AJ" --manifest AndroidManifest.xml -A assets \
  --java build/gen --min-sdk-version 24 --target-sdk-version 34 --version-code "$1" --version-name "$2" build/res.zip
javac -source 11 -target 11 -nowarn -classpath "$AJ" -d build/classes $(find src build/gen -name '*.java')
"$BT/d8" --lib "$AJ" --min-api 24 --output build/dex $(find build/classes -name '*.class')
python3 - <<'PY'
import zipfile, shutil
shutil.copy('build/unsigned.apk','build/with-dex.apk')
with zipfile.ZipFile('build/with-dex.apk','a',zipfile.ZIP_DEFLATED) as z:
    z.write('build/dex/classes.dex','classes.dex')
PY
"$BT/zipalign" -f 4 build/with-dex.apk build/aligned.apk
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$KSPASS" --key-pass "pass:$KSPASS" \
  --out "SHAMSI-menu-$2.apk" build/aligned.apk
echo "готово: SHAMSI-menu-$2.apk"
