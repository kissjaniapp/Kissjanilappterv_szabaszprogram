'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const go=fs.readFileSync(path.join(__dirname,'../desktop-go/launcher/main.go'),'utf8');
const icon=fs.readFileSync(path.join(__dirname,'../tools/embed_win_icon.py'),'utf8');
const checker=fs.readFileSync(path.join(__dirname,'check-pe-icon.py'),'utf8');

test('a Gatterka a Windows tényleges Letöltések mappáját keresi',()=>{
  assert.match(go,/func downloadsFolder\(\) string/);
  assert.match(go,/374DE290-123F-4565-9164-39C4925E467B/);
  assert.match(go,/User Shell Folders/);
  assert.match(go,/filepath\.Join\(home,"Downloads"\)/);
});
test('csak a Gatterka böngészőprofiljának mentési helyét állítja át',()=>{
  assert.match(go,/func configureBrowserDownloads\(profile string\) error/);
  assert.match(go,/filepath\.Join\(profile,"Default","Preferences"\)/);
  assert.match(go,/download\["default_directory"\]=dir/);
  assert.match(go,/download\["prompt_for_download"\]=false/);
  assert.match(go,/section\("savefile"\)\["default_directory"\]=dir/);
  assert.match(go,/json\.Unmarshal\(existing,&prefs\)/);
  assert.match(go,/"Lapterv","BongeszoProfil"/);
  assert.match(go,/configureBrowserDownloads\(userDataDir\)/);
});
test('a launcher nem lép ki rögtön az indítás után',()=>{
  assert.match(go,/cmd\.Wait\(\)/);
  assert.doesNotMatch(go,/cmd\.Process\.Release\(\)/);
});
test('mindhárom EXE saját, modern Windows-kompatibilitási manifestet kap',()=>{
  assert.match(icon,/records\.append\(\(24, 1, APP_MANIFEST\)\)/);
  assert.match(icon,/requestedExecutionLevel level="asInvoker"/);
  assert.match(icon,/8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a/);
  assert.match(checker,/def pe_manifest\(/);
  assert.match(checker,/MANIFEST MISMATCH/);
});

const windowIcon=fs.readFileSync(path.join(__dirname,'../desktop-go/launcher/windowicon_windows.go'),'utf8');
const native=fs.readFileSync(path.join(__dirname,'../desktop-go/launcher/native_bridge.go'),'utf8');
test('a Gatterka maximalizált, visszaállítható Windows-ablakban indul',()=>{
 assert.match(go,/--start-maximized/);
 assert.doesNotMatch(go,/--window-size=1440,900/);
 assert.match(windowIcon,/showWindow\.Call\(hwnd,3\)/);
 assert.doesNotMatch(go,/--kiosk|--start-fullscreen/);
});
test('a natív mappaválasztó és a teljes útvonalon mentő szolgáltatás bekerült',()=>{
 assert.match(go,/startNativeBridge\(page\)/);
 assert.match(go,/#gatterka-native=/);
 assert.match(go,/--app="\+appURL/);
 assert.match(native,/net\.Listen\("tcp","127\.0\.0\.1:"\+nativeAppPort\)/);
 assert.match(native,/FolderBrowserDialog/);
 assert.match(native,/GATTERKA_INITIAL_FOLDER/);
 assert.match(native,/filepath\.Join\(root,folder,"xPrg",name\)/);
 assert.match(native,/func saveMachineFiles\(root string/);
 assert.match(native,/bridge\.selectedDirectory=dir/);
 assert.match(native,/X-Gatterka-Token/);
});

test('a Windows 10/11 modern mappaválasztója látható tulajdonosi ablakot kap',()=>{
 assert.match(native,/AutoUpgradeEnabled=\$true/);
 assert.match(native,/\$owner\.Show\(\)/);
 assert.match(native,/\$picker\.ShowDialog\(\$owner\)/);
 assert.match(native,/patchNativeMix\(content,root,folder\)/);
});

test('ZIP-csomagolás Windows Mentés másként után: külön projektmappa nélkül',()=>{
 assert.match(native,/GetSaveFileNameW/);
 assert.match(native,/GetForegroundWindow/);
 assert.match(native,/windowsSaveFileName/);
 assert.doesNotMatch(native.slice(native.indexOf("func chooseWindowsZipFile("),native.indexOf("// Kizárólag egy ZIP mentődik.")),/exec\.Command\("powershell\.exe"/);
 assert.match(native,/router.HandleFunc\("\/native\/choose-save-as"/);
 assert.match(native,/router.HandleFunc\("\/native\/write-zip"/);
 assert.match(native,/func writeMachineArchive\(zipPath string,req nativeSave\)error/);
 assert.match(native,/patchNativeMix\(content,root,req.CabinetFolder\)/);
 const from=native.indexOf('func saveMachineZipAt(');
 const to=native.indexOf('func (bridge *nativeBridge) chooseSaveAs(',from);
 assert.ok(from>=0&&to>from);
 assert.doesNotMatch(native.slice(from,to),/saveMachineFiles\(/);
});

test('a Gatterka HTML a helyi mentéssel azonos eredetű HTTP-oldalként indul',()=>{
 assert.match(go,/appURL:="http:\/\/127\.0\.0\.1:"\+strconv\.Itoa\(port\)/);
 assert.doesNotMatch(go,/appURL:=fileURL\(page\)/);
 assert.match(native,/const nativeAppPort="18737"/);
 assert.match(native,/router\.HandleFunc\("\/",func\(w http\.ResponseWriter,r \*http\.Request\)/);
 assert.match(native,/http\.ServeFile\(w,r,page\)/);
 assert.match(native,/origin!="http:\/\/"\+r\.Host/);
});
