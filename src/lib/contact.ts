/** Real Indian emergency resources, shown wherever a patient's family might need help. */
export const EMERGENCY = {
  allEmergencies: '112',
  ambulance: '108',
  bloodBankSearchUrl: 'https://eraktkosh.mohfw.gov.in/',
};

/**
 * The project's own inbox. There is deliberately no fallback: lifelink.ai
 * belongs to an unrelated company, so an invented default would send users'
 * (possibly medical) messages to a stranger. Empty hides email contact.
 */
export const CONTACT_EMAIL: string = import.meta.env.VITE_CONTACT_EMAIL || '';
