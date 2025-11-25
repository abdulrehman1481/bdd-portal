import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for bypassing RLS during profile creation
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, role, profileData } = body;

    if (role === 'donor') {
      // Create donor profile
      const { data: donorData, error: donorError } = await supabaseAdmin
        .from('donors')
        .insert({
          user_id: userId,
          blood_type: profileData.bloodType || 'O+',
          date_of_birth: profileData.dateOfBirth,
          gender: profileData.gender,
          is_available: true,
          health_status: 'eligible',
        })
        .select('id')
        .single();

      if (donorError) {
        console.error('Donor creation error:', donorError);
        return NextResponse.json({ error: donorError.message }, { status: 400 });
      }

      // Create donor location if provided
      if (donorData && profileData.latitude && profileData.longitude) {
        const { error: locationError } = await supabaseAdmin
          .from('donor_locations')
          .insert({
            donor_id: donorData.id,
            latitude: profileData.latitude,
            longitude: profileData.longitude,
            city: profileData.city || '',
            address: profileData.address || '',
            location_type: 'current',
            is_primary: true,
          });

        if (locationError) {
          console.error('Donor location error:', locationError);
          // Don't fail the entire registration, just log the error
        }
      }
    } else if (role === 'hospital') {
      // Create hospital profile with location
      const { error: hospitalError } = await supabaseAdmin
        .from('hospitals')
        .insert({
          user_id: userId,
          name: profileData.hospitalName,
          license_number: profileData.licenseNumber,
          address: profileData.address,
          city: profileData.city,
          phone: profileData.phone,
          latitude: profileData.latitude || 0,
          longitude: profileData.longitude || 0,
          is_verified: false,
        });

      if (hospitalError) {
        console.error('Hospital creation error:', hospitalError);
        return NextResponse.json({ error: hospitalError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Profile creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
