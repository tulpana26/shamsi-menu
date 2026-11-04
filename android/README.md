# Android-приложение SHAMSI

Нативная обёртка (WebView) вокруг меню `https://tulpana26.github.io/shamsi-menu/`.
Меню обновляется на сайте — приложение подтягивает свежую версию при запуске,
пересобирать APK для смены цен не нужно.

## Что внутри

```
AndroidManifest.xml          пакет com.shamsi.menu, minSdk 24, targetSdk 34
src/.../MainActivity.java     WebView + обработка кнопки «назад» + офлайн-страница
res/mipmap-*/ic_launcher.png  иконки
assets/offline.html           заглушка без интернета
build.sh                      сборка без Gradle
```

## Пересборка

```bash
export ANDROID_HOME=~/android-sdk
export KEYSTORE=~/keys/shamsi.jks          # тот же ключ, иначе Android не поставит обновление
export KEYSTORE_PASS=...
./build.sh 2 1.1                           # версия код + имя версии
```

Инструменты: JDK 17 и Android SDK (`platforms;android-34`, `build-tools;34.0.0`).

## Ключ подписи

Первый APK подписан ключом `shamsi` (SHA-256 `14ac7cd8…02 33`), пароль хранится
в приватном репозитории `agent-api-keys`. Без этого ключа обновления не встанут
поверх установленной версии — придётся удалять приложение.
