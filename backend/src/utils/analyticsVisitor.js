import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';

// Use Express's configured proxy trust, never read untrusted forwarding headers.
export function visitorIpHash(req) {
 let address=String(req.ip || req.socket?.remoteAddress || '').toLowerCase();
 if (address.startsWith('::ffff:') && isIP(address.slice(7))===4) address=address.slice(7);
 if (!isIP(address)) return null;
 if (isIP(address)===6) address=new URL('http://['+address+']/').hostname;
 const secret=process.env.AUTH_SECRET || process.env.DB_PASSWORD;
 if (!secret) return null;
 return createHmac('sha256',secret).update('sarva-analytics-ip-v1:'+address).digest('hex');
}
