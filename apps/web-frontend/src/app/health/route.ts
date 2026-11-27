import { NextResponse } from 'next/server';
import {
  buildFrontendHealthPayload,
  type FrontendHealthPayload,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export function GET(): NextResponse<FrontendHealthPayload> {
  return NextResponse.json(buildFrontendHealthPayload(), {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
