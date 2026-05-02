import { auth } from './backend/auth.js';
import { fromNodeHeaders } from 'better-auth/node';

async function test() {
  try {
    const res = await auth.api.signInEmail({
      body: {
        email: 'bobonation09@gmail.com',
        password: 'admin123'
      }
    });
    console.log('Success:', res);
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
