import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const statePath = path.join(process.cwd(), '..', 'timeline-watcher', 'state.json');
    
    if (!fs.existsSync(statePath)) {
      return NextResponse.json({ seenTweets: [], lastPoll: null, lastCount: 0 });
    }
    
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
