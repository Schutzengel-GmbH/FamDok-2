import dotenv from 'dotenv';
import path from 'path';

// Resolved relative to this file (not process.cwd()) so it works regardless
// of which directory a script is invoked from. In the compiled Docker image
// this path doesn't exist and dotenv silently no-ops - correct, since
// production values are injected as real environment variables by
// docker-compose, not read from a file.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
