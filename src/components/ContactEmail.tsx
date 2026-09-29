import React from 'react';
import { Link } from 'react-router-dom';
import { CONTACT_EMAIL } from '../lib/contact';

/** The contact inbox as a mailto link, or a pointer to the Support page when none is set. */
export default function ContactEmail() {
  return CONTACT_EMAIL
    ? <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#ee2b2b] font-bold hover:underline">{CONTACT_EMAIL}</a>
    : <>the contact options on our <Link to="/support" className="text-[#ee2b2b] font-bold hover:underline">Support page</Link></>;
}
