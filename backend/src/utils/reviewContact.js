export function reviewContact(body) {
 const contactName=body.contactName ?? '',contactEmail=body.contactEmail ?? '';
 if(typeof contactName!=='string'||contactName.length>100||/[\x00-\x1f]/.test(contactName)||typeof contactEmail!=='string'||contactEmail.length>254)throw Error('Invalid contact details');
 const email=contactEmail.trim();
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Invalid contact email');
 return {contactName:contactName.trim(),contactEmail:email};
}
