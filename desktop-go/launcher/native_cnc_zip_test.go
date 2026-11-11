package main

import (
 "archive/zip"
 "io"
 "os"
 "path/filepath"
 "strings"
 "testing"
)

func TestCncZipChosenDirectoryAndProtectedPreviousArchive(t *testing.T) {
 dir:=t.TempDir()
 target:=filepath.Join(dir,"Gatterka_CNC_XXL.zip")
 content:="H DX=964 DY=396 DZ=18 -IJ C=0 T=196608 R=100 *MM /\"DEF\" BX=0 BY=0 BZ=0 V=1\r\nLAPA X=491 Y=0 A=0 y=396 G=1\r\n;\r\nVEGE\r\n"
 req:=nativeCncSave{Programs:[]nativeProgram{{Name:"Polc_01.xxl",Content:content},{Name:"Polc_02.xxl",Content:content}}}
 saved,err:=saveCncZipFiles(target,req)
 if err!=nil{t.Fatal(err)}
 if saved!=target{t.Fatalf("Mentés más mappába: %q",saved)}
 z,err:=zip.OpenReader(saved)
 if err!=nil{t.Fatal(err)}
 if len(z.File)!=2{t.Fatalf("Programszám: %d",len(z.File))}
 for _,entry:=range z.File {
   file,err:=entry.Open()
   if err!=nil{t.Fatal(err)}
   raw,err:=io.ReadAll(file);_ =file.Close()
   if err!=nil{t.Fatal(err)}
   if string(raw)!=content{t.Fatalf("Tartalom módosult: %s",entry.Name)}
 }
 if err=z.Close();err!=nil{t.Fatal(err)}
 saved2,err:=saveCncZipFiles(target,req)
 if err!=nil{t.Fatal(err)}
 if saved2==saved||!strings.HasSuffix(saved2,"_2.zip"){t.Fatalf("Ütköző mentés: %q",saved2)}
 if st,err:=os.Stat(saved2);err!=nil||st.Size()==0{t.Fatal("Második ZIP hiányzik")}
}

func TestCncZipRejectsUnsafeNamesAndInvalidPrograms(t *testing.T) {
 content:="H DX=964 DY=396 DZ=18 -IJ C=0 T=196608 R=100 *MM /\"DEF\" BX=0 BY=0 BZ=0 V=1\r\n;\r\nVEGE\r\n"
 cases:=[]nativeCncSave{
  {},
  {Programs:[]nativeProgram{{Name:"../elszokott.xxl",Content:content}}},
  {Programs:[]nativeProgram{{Name:"oldal/abc.xxl",Content:content}}},
  {Programs:[]nativeProgram{{Name:"test.xxl",Content:"VEGE"}}},
  {Programs:[]nativeProgram{{Name:"Polc.xxl",Content:content},{Name:"polc.xxl",Content:content}}},
 }
 for _,req:=range cases {
   if err:=validateCncZip(req);err==nil{t.Errorf("Hiányzó CNC validáció: %+v",req)}
 }
}
