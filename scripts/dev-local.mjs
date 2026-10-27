import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{stdio:'inherit',env:{...process.env,VITE_EMULATOR:'true'}});
child.on('exit',code=>{process.exitCode=code||0;});
