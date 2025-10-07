import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/revcat'
});