import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST() {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), '..', 'timeline-watcher', 'timeline.js');
    const envPath = path.join(process.cwd(), '..', 'timeline-watcher', '.env');
    
    // Load env vars
    let envVars = {};
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && !key.startsWith('#')) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      });
    }
    
    const env = { ...process.env, ...envVars };
    
    exec(`node ${scriptPath}`, { env, cwd: path.dirname(scriptPath) }, (error, stdout, stderr) => {
      if (error) {
        console.error('Poll error:', stderr || error.message);
        resolve(NextResponse.json({ success: false, error: stderr || error.message }, { status: 500 }));
        return;
      }
      
      // Parse output to get tweet count
      const match = stdout.match(/Found (\d+) tweets, (\d+) new/);
      const newTweets = match ? parseInt(match[2]) : 0;
      
      resolve(NextResponse.json({ success: true, newTweets, output: stdout }));
    });
  });
}
