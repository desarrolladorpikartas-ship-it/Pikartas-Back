import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Don't throw error on import - let it fail gracefully
let supabase;
let supabaseAdmin;

// Cliente público (anon key) - respeta RLS para operaciones públicas
if (!supabaseUrl) {
  console.error('SUPABASE_URL is not set - Supabase operations will fail');
  // Create a dummy client to prevent crashes on import
  supabase = createClient('https://dummy.supabase.co', supabaseKey || '');
} else if (!supabaseKey) {
  console.error('SUPABASE_KEY is not set - Supabase operations will fail');
  // Create a dummy client to prevent crashes on import
  supabase = createClient(supabaseUrl, '');
} else {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Cliente administrativo (service role key) - ignora RLS para operaciones administrativas
if (!supabaseUrl) {
  console.error('SUPABASE_URL is not set - Admin Supabase operations will fail');
  supabaseAdmin = createClient('https://dummy.supabase.co', supabaseServiceRoleKey || '');
} else if (!supabaseServiceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set - Admin operations will fail due to RLS');
  console.error('Falling back to anon key, but this may not work with RLS policies');
  // Fallback to anon key if service role key is not set (for backward compatibility)
  // WARNING: This will likely fail with RLS policies that require service_role
  supabaseAdmin = createClient(supabaseUrl, supabaseKey || '');
} else {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
}

export { supabase, supabaseAdmin };

// Función para inicializar la conexión (opcional - para mantener compatibilidad con el código existente)
const connectDB = async () => {
  if (!supabaseKey) {
    throw new Error('SUPABASE_KEY is required');
  }

  try {
    // Consulta de prueba sobre users vía service role (tabla users suele tener RLS; anon fallaría)
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('users').select('count').limit(1)
    if (error && error.code !== 'PGRST116') { // PGRST116 es "tabla no encontrada", lo cual es OK
      throw error
    }
    // Connection successful
  } catch (error) {
    console.error('Error al conectar a Supabase:', error);
    // Don't exit in serverless environments
    if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
      process.exit(1);
    }
    throw error; // Re-throw so caller can handle it
  }
};

export default connectDB;
