import { beforeAll, afterAll } from 'vitest';
import { supabase } from '../lib/supabase';

// Global setup for tests
beforeAll(async () => {
    // Check if we have connectivity to Supabase
    const { error } = await supabase.from('schedules').select('id').limit(1);
    if (error) {
        console.warn('⚠️  Supabase connectivity check failed:', error.message);
        console.warn('Integration tests might fail if VITE_SUPABASE_URL/KEY are not set correctly.');
    }
});

afterAll(async () => {
    // Cleanup would go here if we used a global test suite
});
