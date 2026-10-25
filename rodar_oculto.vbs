' Pega o caminho da pasta onde o próprio script está
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptPath = FSO.GetParentFolderName(WScript.ScriptFullName)

' Monta o caminho completo para o iniciar.bat na mesma pasta
Comando = chr(34) & ScriptPath & "\iniciar.bat" & chr(34)

' Executa o comando
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run Comando, 0, false