param(
    [string]$DeviceSerial,
    [string]$SdkPath = $env:ANDROID_HOME,
    [string]$JavaPath = $env:JAVA_HOME
)
$ErrorActionPreference = 'Stop'
if (-not $SdkPath) { $SdkPath = [Environment]::GetEnvironmentVariable('ANDROID_HOME', 'User') }
if (-not $JavaPath) { $JavaPath = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'User') }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $installedNodePath = Join-Path $env:LOCALAPPDATA 'GroupPoster/toolchain/node-v22.16.0-win-x64'
    if (Test-Path -LiteralPath (Join-Path $installedNodePath 'node.exe')) {
        $env:PATH = $installedNodePath + ';' + $env:PATH
    }
}
$repositoryPath = Split-Path -Parent $PSScriptRoot
# Keep the project below a short drive path. Expo cannot discover package.json
# at a drive root, and Windows Ninja cannot compile deeply nested object paths.
$parentPath = Split-Path -Parent $repositoryPath
$folderName = Split-Path -Leaf $repositoryPath
$mapping = @(subst.exe | Where-Object { $_.EndsWith('=> ' + $parentPath, [StringComparison]::OrdinalIgnoreCase) })
if ($mapping.Count -gt 0) {
    $buildDrive = $mapping[0].Substring(0, 2)
} else {
    $buildDrive = @('R:', 'S:', 'T:', 'U:', 'V:', 'W:', 'X:', 'Y:', 'Z:') | Where-Object {
        -not (Test-Path -LiteralPath ($_ + '\'))
    } | Select-Object -First 1
    if (-not $buildDrive) { throw 'No free drive for a short native build path.' }
    subst.exe $buildDrive $parentPath
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the short native build path.' }
}
$buildRepositoryPath = Join-Path ($buildDrive + '\') $folderName
if (-not (Test-Path -LiteralPath (Join-Path $buildRepositoryPath 'package.json'))) {
    throw 'Short build path does not resolve to this project.'
}
if (-not $SdkPath -or -not (Test-Path -LiteralPath (Join-Path $SdkPath 'platform-tools/adb.exe'))) {
    throw 'Set ANDROID_HOME or pass -SdkPath for an installed Android SDK.'
}
if (-not $JavaPath -or -not (Test-Path -LiteralPath (Join-Path $JavaPath 'bin/java.exe'))) {
    throw 'Set JAVA_HOME or pass -JavaPath for JDK 17 or newer.'
}
Get-Command node -ErrorAction Stop | Out-Null
$adbPath = Join-Path $SdkPath 'platform-tools/adb.exe'
$connectedDevices = @(& $adbPath devices | Select-String '^([^\s]+)\s+device$' | ForEach-Object { $_.Matches[0].Groups[1].Value })
if (-not $DeviceSerial) {
    if ($connectedDevices.Count -ne 1) { throw 'Connect and authorize one Android device, or specify -DeviceSerial.' }
    $DeviceSerial = $connectedDevices[0]
}
if ($connectedDevices -notcontains $DeviceSerial) { throw 'The selected Android device is not connected and authorized.' }
$architecture = (& $adbPath -s $DeviceSerial shell getprop ro.product.cpu.abi).Trim()
if ($architecture -notin @('arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86')) { throw 'Unsupported device architecture.' }
$env:JAVA_HOME = $JavaPath
$env:ANDROID_HOME = $SdkPath
$env:NODE_ENV = 'production'
$property = 'sdk.dir=' + $SdkPath.Replace('\', '/')
$nativePath = Join-Path $buildRepositoryPath 'android'
if (-not (Test-Path -LiteralPath $nativePath)) { throw 'Generate native files first: npx expo prebuild --platform android --no-install' }
[IO.File]::WriteAllText((Join-Path $nativePath 'local.properties'), $property + "`n")
$statePath = Join-Path $repositoryPath '.expo/android-build-root.txt'
$previousRoot = if (Test-Path -LiteralPath $statePath) { [IO.File]::ReadAllText($statePath).Trim() } else { '' }
if ($previousRoot -ne $buildRepositoryPath) {
    $nativeCaches = @(
        'android/app/.cxx',
        'android/build/generated/autolinking',
        'node_modules/react-native-worklets/android/.cxx',
        'node_modules/react-native-reanimated/android/.cxx',
        'node_modules/react-native-screens/android/.cxx',
        'node_modules/react-native-gesture-handler/android/.cxx',
        'node_modules/react-native-safe-area-context/android/.cxx',
        'node_modules/expo-modules-core/android/.cxx'
    )
    foreach ($relativeCache in $nativeCaches) {
        $cachePath = [IO.Path]::GetFullPath((Join-Path $repositoryPath $relativeCache))
        if (-not $cachePath.StartsWith($repositoryPath + '\', [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Native cache path escaped the repository.'
        }
        if (Test-Path -LiteralPath $cachePath) {
            $backupName = (Split-Path -Leaf $cachePath) + '.path-backup-' + [Guid]::NewGuid().ToString('N')
            Rename-Item -LiteralPath $cachePath -NewName $backupName
        }
    }
    New-Item -ItemType Directory -Force (Split-Path -Parent $statePath) | Out-Null
    [IO.File]::WriteAllText($statePath, $buildRepositoryPath + "`n")
}
Push-Location $nativePath
try {
    & (Join-Path $JavaPath 'bin/java.exe') '-Xmx64m' '-Dorg.gradle.appname=gradlew' '-jar' (Join-Path $nativePath 'gradle/wrapper/gradle-wrapper.jar') ':app:assembleRelease' "-PreactNativeArchitectures=$architecture" '-Pkotlin.incremental=false' '--max-workers=2' '--console=plain' '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -Djava.net.preferIPv4Stack=true -Dfile.encoding=UTF-8'
    if ($LASTEXITCODE -ne 0) { throw 'Android APK compilation failed.' }
} finally { Pop-Location }
$apkPath = Join-Path $nativePath 'app/build/outputs/apk/release/app-release.apk'
$artifactPath = Join-Path $repositoryPath 'artifacts'
New-Item -ItemType Directory -Force $artifactPath | Out-Null
$previewPath = Join-Path $artifactPath 'GroupPoster-preview.apk'
Copy-Item -LiteralPath $apkPath -Destination $previewPath -Force
& $adbPath -s $DeviceSerial install -r $previewPath
if ($LASTEXITCODE -ne 0) { throw 'Installation failed. No existing app data was deleted.' }
& $adbPath -s $DeviceSerial shell am start -n 'com.groupposter.manager/.MainActivity'
if ($LASTEXITCODE -ne 0) { throw 'The APK installed, but launching failed.' }
Write-Output "Installed preview APK: $previewPath"
# The generated local release variant uses the standard debug signing certificate.
# This is a standalone device preview, not a Google Play production signing workflow.
