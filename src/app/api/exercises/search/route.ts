// Thin Route Handler for the +Add Exercise drawer's autocomplete.
// Delegates to the existing searchExercises query helper (Plan 01-02). Empty
// query returns the full sorted catalog so opening the drawer without typing
// shows something useful.
//
// This is a public endpoint per T-01-03-04 in the threat register; the
// catalog is non-sensitive (just exercise display names).

import { NextResponse } from 'next/server';
import { searchExercises } from '@/db/queries/exercises';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const results = await searchExercises(q);
  return NextResponse.json(results);
}
