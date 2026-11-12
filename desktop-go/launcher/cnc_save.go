// Gatterka: CNC/Xilog XXL programok közvetlen Windows Mentés másként mentése.
// A szabászati xMix/xPrg fájlmentésétől független: egyetlen valódi .xxl
// nevet választ a felhasználó, a további hiteles programok mellé kerülnek.
package main

import (
 "errors"
 "fmt"
 "os"
 "path/filepath"
 "strings"
)

type nativeCncSave struct {
 Programs []nativeProgram `json:"programs"`
 Report string `json:"report"`
}
type savedCncFiles struct {
 FirstPath string `json:"firstPath"`
 Folder string `json:"folder"`
 Programs []string `json:"programs"`
 ReportPath string `json:"reportPath,omitempty"`
 Partial bool `json:"partial"`
}

func validateCncSave(req nativeCncSave) error {
 if len(req.Programs)==0{return errors.New("Nincs hitelesített CNC .xxl program a mentéshez.")}
 seen:=make(map[string]bool,len(req.Programs))
 for _,p:=range req.Programs {
  if !machineXxlName.MatchString(p.Name)||strings.Contains(p.Name,"..")||strings.HasPrefix(p.Name,".") {
   return errors.New("Érvénytelen CNC fájlnév: "+p.Name)
  }
  stem:=strings.ToUpper(strings.Split(p.Name,".")[0])
  switch stem {
  case "CON","PRN","AUX","NUL","COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9","LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9":
   return errors.New("Fenntartott Windows-fájlnév: "+p.Name)
  }
  key:=strings.ToLower(p.Name)
  if seen[key] {return errors.New("Ismétlődő CNC fájlnév: "+p.Name)}
  seen[key]=true
  body:=strings.TrimSpace(p.Content)
  if !strings.HasPrefix(body,"H DX=")||!strings.Contains(body," DZ=")||
   !strings.Contains(body,"\nVEGE")||strings.ContainsRune(body,0){
   return errors.New("Az XXL program hibás vagy hiányos: "+p.Name)
  }
 }
 if req.Report!=""&&!strings.HasPrefix(req.Report,"GATTERKA"){
  return errors.New("A CNC kihagyási jelentés hibás.")
 }
 return nil
}

// saveCncAndPrograms nem használ zipletöltést, böngésző- vagy ideiglenes
// letöltési mappát: ténylegesen a felhasználó által kiválasztott útvonalra ír.
// Hiba esetén az új mellékfájlokat törli, az első kiválasztott XXL-t csak
// a többi program és a jelentés sikeres elkészülése után cseréli.
func saveCncAndPrograms(firstPath string,req nativeCncSave)(savedCncFiles,error){
 var result savedCncFiles
 if err:=validateCncSave(req);err!=nil{return result,err}
 if !filepath.IsAbs(firstPath)||!strings.EqualFold(filepath.Ext(firstPath),".xxl"){
  return result,errors.New("A CNC mentési cél teljes .xxl fájlútvonal kell legyen.")
 }
 folder:=filepath.Dir(firstPath)
 if st,err:=os.Stat(folder);err!=nil||!st.IsDir(){
  return result,errors.New("A kiválasztott CNC célmappa nem érhető el.")
 }
 if st,err:=os.Stat(firstPath);err==nil&&st.IsDir(){
  return result,errors.New("A megadott CNC .xxl fájlnév egy létező mappára mutat.")
 }
 created:=[]string{}
 success:=false
 defer func(){
  if !success{for _,p:=range created{_ =os.Remove(p)}}
 }()
 // A választott .xxl ténylegesen az első alkatrész programja.
 // A többi saját, ütközésmentes névvel kerül ugyanabba a mappába.
 result.Folder=folder
 result.FirstPath=firstPath
 result.Programs=append(result.Programs,firstPath)
 for _,prog:=range req.Programs[1:]{
  name:=prog.Name
  if strings.EqualFold(name,filepath.Base(firstPath)){
   ext:=filepath.Ext(name)
   name=strings.TrimSuffix(name,ext)+"_2"+ext
  }
  path,err:=createExclusive(folder,name,prog.Content)
  if err!=nil{return savedCncFiles{},fmt.Errorf("CNC XXL mentési hiba (%s): %w",prog.Name,err)}
  created=append(created,path)
  result.Programs=append(result.Programs,path)
 }
 if req.Report!=""{
  path,err:=createExclusive(folder,"ELLENORIZENDO_KIMARADT.txt",req.Report)
  if err!=nil{return savedCncFiles{},fmt.Errorf("Kihagyási jelentés mentési hiba: %w",err)}
  created=append(created,path)
  result.ReportPath=path
  result.Partial=true
 }
 tmp,err:=os.CreateTemp(folder,".gatterka-cnc-*.tmp")
 if err!=nil{return savedCncFiles{},fmt.Errorf("Az első CNC-fájl nem hozható létre: %w",err)}
 tempPath:=tmp.Name()
 defer func(){_ =os.Remove(tempPath)}()
 if _,err=tmp.WriteString(req.Programs[0].Content);err!=nil{_ =tmp.Close();return savedCncFiles{},err}
 if err=tmp.Sync();err!=nil{_ =tmp.Close();return savedCncFiles{},err}
 if err=tmp.Close();err!=nil{return savedCncFiles{},err}
 if err=os.Rename(tempPath,firstPath);err!=nil{
  return savedCncFiles{},fmt.Errorf("A választott .xxl fájl nem menthető: %w",err)
 }
 success=true
 return result,nil
}
