# The Android app

For whoever builds and publishes the Android app. Back to the [README](../README.md).

The Android app (`app.nebokrai`) is the same site shown full screen by Chrome:
a Trusted Web Activity. It has no code of its own, so the site's updates are
the app's updates, and sign-in and saved words work as they do in the browser.

| File | |
|---|---|
| `android/twa-manifest.json` | What the app is built from: package name, colours, icons, version. The only file in `android/` that is in git. |
| `static/.well-known/assetlinks.json` | The site vouching for the app. It lists the SHA-256 fingerprint of every key the app is signed with; without a match Chrome shows its address bar inside the app. |
| `tests/android.test.ts` | Holds the two files and the web manifest together. |

Building needs [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
(`npm i -g @bubblewrap/cli`), JDK 17 and the Android SDK; `bubblewrap doctor`
checks them. From `android/`:

```sh
bubblewrap update --skipVersionUpgrade  # writes the Android project from twa-manifest.json
bubblewrap build                        # app-release-signed.apk and app-release-bundle.aab
bubblewrap install                      # onto a phone connected with USB debugging
```

Things to know:

- **The signing key is not in the repo.** `signingKey.path` in
  `twa-manifest.json` says where it is on the machine that builds. Back it up:
  an update signed with another key is refused. `bubblewrap build` asks for
  its password, or reads `BUBBLEWRAP_KEYSTORE_PASSWORD` and
  `BUBBLEWRAP_KEY_PASSWORD`.
- **Google Play signs the published app with a key of its own.** Its
  fingerprint (Play Console, "App signing") goes into `assetlinks.json` and
  into `fingerprints` in `twa-manifest.json` beside the upload key's, and the
  site is deployed again.
- **Every upload to Play needs a higher `appVersionCode`.** `bubblewrap
  update` without `--skipVersionUpgrade` raises it.
- **On Windows, `bubblewrap build` fails with "'gradlew.bat' is not
  recognized"** when `NoDefaultCurrentDirectoryInExePath` is set in the
  environment. Remove it for that command.
- **Android 7 is the oldest version the app runs on** (`minSdkVersion` 24,
  which the library that opens Chrome requires).
