@echo off
setlocal

cd /d "%~dp0"
set "PORT=8000"
set "HOST=127.0.0.1"
set "URL=http://%HOST%:%PORT%/"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js tidak ditemukan.
    echo Install Node.js atau jalankan project ini dengan server statis lain.
    echo.
    pause
    exit /b 1
)

title Syntetika Engine Local Server
echo Starting Syntetika Engine...
echo Folder : %CD%
echo URL    : %URL%
echo OSC    : http://127.0.0.1:8765/osc
echo.
echo Tutup window ini untuk menghentikan server.
echo.

start "Syntetika Engine OSC Bridge" /min node osc-bridge.js

node -e "const http=require('http');const fs=require('fs');const path=require('path');const cp=require('child_process');const root=process.cwd();const host=process.env.HOST||'127.0.0.1';const port=Number(process.env.PORT||8000);const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.json':'application/json; charset=utf-8'};function send(res,status,body,type='text/plain; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body)}const server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost');let filePath=path.normalize(path.join(root,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname)));if(!filePath.startsWith(root)){send(res,403,'Forbidden');return}fs.readFile(filePath,(err,data)=>{if(err){send(res,404,'Not found');return}res.writeHead(200,{'Content-Type':types[path.extname(filePath).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)})}catch(err){send(res,500,String(err&&err.message||err))}});server.on('error',(err)=>{console.error('Server gagal:',err.message);process.exit(1)});server.listen(port,host,()=>{const target='http://'+host+':'+port+'/';console.log('Syntetika Engine running at '+target);cp.exec('start \"\" \"'+target+'\"')});"

pause
