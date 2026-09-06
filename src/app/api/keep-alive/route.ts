import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Simple query to keep Supabase alive
    await supabase.from('profiles').select('id').limit(1);
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    return new NextResponse('Error', { status: 500 });
  }
}