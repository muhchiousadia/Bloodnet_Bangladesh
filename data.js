/* ==========================================================================
   BloodNet Bangladesh — prototype dataset
   --------------------------------------------------------------------------
   FICTIONAL SAMPLE DATA. No real donor, hospital or request is represented.

   Each collection below mirrors a table planned for Segment 2 (MySQL/MongoDB),
   so the UI can later read the same shapes from an API without being rebuilt:
     locations -> districts / upazilas / areas
     donors    -> users + donor_profiles + donation_history
     hospitals -> hospitals + blood_stock (verification date per hospital)
     requests  -> emergency_requests
   Availability is never stored: it is derived from lastDonation + cooldown.
   ========================================================================== */

var BloodNet = {
  meta: {
    /* The prototype runs on a fixed clock so the sample records stay
       internally consistent with the Segment 1 document. */
    today: '2026-08-28',
    cooldownMonths: 3,
    stockLow: 3 // units at or below this (and above 0) read as LOW
  },

  bloodGroups: ['A+', 'A−', 'B+', 'B−', 'O+', 'O−', 'AB+', 'AB−'],

  urgencyLevels: ['Critical', 'Urgent', 'Planned'],

  locations: {
    'Chattogram': {
      'Boalkhali': ['Kadurkhil', 'Sakpura', 'Popadia', 'Charandwip', 'Boalkhali Sadar', 'Ahla Karaldenga'],
      'Kotwali': ['Jamalkhan', 'Chawkbazar', 'Anderkilla'],
      'Patiya': ['Patiya Sadar', 'Kolagaon'],
      'Hathazari': ['Hathazari Sadar', 'Fatehpur'],
      'Rangunia': ['Rangunia Sadar']
    },
    'Dhaka': {
      'Dhanmondi': ['Dhanmondi 27', 'Shankar'],
      'Mirpur': ['Mirpur 10', 'Pallabi'],
      'Uttara': ['Sector 7']
    },
    'Sylhet': {
      'Sylhet Sadar': ['Zindabazar', 'Amberkhana']
    }
  },

  /* 18 sample donor records — the directory count quoted in the proposal.
     Contact values are deliberately stored masked; see the privacy note in
     the donor profile. */
  donors: [
    { id: 'BN-D-1041', name: 'Rifat Hasan', group: 'O+', district: 'Chattogram', upazila: 'Boalkhali', area: 'Kadurkhil', mobile: '01XXX-XXXXXX', email: 'rifat.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-02-12' },
    { id: 'BN-D-1042', name: 'Nusrat Jahan', group: 'B+', district: 'Chattogram', upazila: 'Boalkhali', area: 'Sakpura', mobile: '01XXX-XXXXXX', email: 'nusrat.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-07-14' },
    { id: 'BN-D-1043', name: 'Tanvir Ahmed', group: 'A+', district: 'Chattogram', upazila: 'Boalkhali', area: 'Popadia', mobile: '01XXX-XXXXXX', email: 'tanvir.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-03-05' },
    { id: 'BN-D-1044', name: 'Sabina Akter', group: 'AB+', district: 'Chattogram', upazila: 'Boalkhali', area: 'Boalkhali Sadar', mobile: '01XXX-XXXXXX', email: 'sabina.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-06-22' },
    { id: 'BN-D-1045', name: 'Imran Kabir', group: 'O−', district: 'Chattogram', upazila: 'Boalkhali', area: 'Charandwip', mobile: '01XXX-XXXXXX', email: 'imran.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-01-18' },
    { id: 'BN-D-1046', name: 'Mehedi Hasan', group: 'B−', district: 'Chattogram', upazila: 'Boalkhali', area: 'Ahla Karaldenga', mobile: '01XXX-XXXXXX', email: 'mehedi.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2025-12-02' },
    { id: 'BN-D-1047', name: 'Farhana Yeasmin', group: 'O+', district: 'Chattogram', upazila: 'Boalkhali', area: 'Sakpura', mobile: '01XXX-XXXXXX', email: 'farhana.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-08-02' },
    { id: 'BN-D-1048', name: 'Arif Chowdhury', group: 'A−', district: 'Chattogram', upazila: 'Boalkhali', area: 'Kadurkhil', mobile: '01XXX-XXXXXX', email: 'arif.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-04-19' },
    { id: 'BN-D-1049', name: 'Sadia Islam', group: 'AB−', district: 'Chattogram', upazila: 'Kotwali', area: 'Jamalkhan', mobile: '01XXX-XXXXXX', email: 'sadia.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-05-30' },
    { id: 'BN-D-1050', name: 'Rakib Uddin', group: 'O+', district: 'Chattogram', upazila: 'Kotwali', area: 'Chawkbazar', mobile: '01XXX-XXXXXX', email: 'rakib.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-02-28' },
    { id: 'BN-D-1051', name: 'Tasnim Nowshin', group: 'B+', district: 'Chattogram', upazila: 'Kotwali', area: 'Anderkilla', mobile: '01XXX-XXXXXX', email: 'tasnim.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-06-11' },
    { id: 'BN-D-1052', name: 'Shahriar Alam', group: 'A+', district: 'Chattogram', upazila: 'Kotwali', area: 'Jamalkhan', mobile: '01XXX-XXXXXX', email: 'shahriar.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2025-11-20' },
    { id: 'BN-D-1053', name: 'Jannatul Ferdous', group: 'O−', district: 'Chattogram', upazila: 'Patiya', area: 'Patiya Sadar', mobile: '01XXX-XXXXXX', email: 'jannatul.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-04-02' },
    { id: 'BN-D-1054', name: 'Nayeem Hossain', group: 'AB+', district: 'Chattogram', upazila: 'Patiya', area: 'Kolagaon', mobile: '01XXX-XXXXXX', email: 'nayeem.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-07-25' },
    { id: 'BN-D-1055', name: 'Sumaiya Rahman', group: 'B−', district: 'Chattogram', upazila: 'Patiya', area: 'Patiya Sadar', mobile: '01XXX-XXXXXX', email: 'sumaiya.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-01-09' },
    { id: 'BN-D-1056', name: 'Tofayel Siddique', group: 'A+', district: 'Chattogram', upazila: 'Hathazari', area: 'Hathazari Sadar', mobile: '01XXX-XXXXXX', email: 'tofayel.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-03-22' },
    { id: 'BN-D-1057', name: 'Ruponti Das', group: 'O+', district: 'Chattogram', upazila: 'Hathazari', area: 'Fatehpur', mobile: '01XXX-XXXXXX', email: 'ruponti.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2026-06-05' },
    { id: 'BN-D-1058', name: 'Mahfuzur Rahman', group: 'AB−', district: 'Chattogram', upazila: 'Rangunia', area: 'Rangunia Sadar', mobile: '01XXX-XXXXXX', email: 'mahfuz.demo@example.com', emergency: '01XXX-XXXXXX', lastDonation: '2025-10-14' }
  ],

  /* Stock units are listed in bloodGroups order. Status is derived, never
     stored, so a future API only has to supply units + verification date. */
  hospitals: [
    { id: 'BN-H-01', name: 'Kornofuli General Hospital', district: 'Chattogram', upazila: 'Boalkhali', area: 'Boalkhali', verified: '2026-08-26', units: [4, 1, 3, 0, 6, 2, 1, 0] },
    { id: 'BN-H-02', name: 'Boalkhali Community Hospital', district: 'Chattogram', upazila: 'Boalkhali', area: 'Boalkhali', verified: '2026-08-25', units: [2, 0, 2, 1, 3, 0, 0, 1] },
    { id: 'BN-H-03', name: 'Chattogram City Blood Bank', district: 'Chattogram', upazila: 'Kotwali', area: 'Kotwali', verified: '2026-08-27', units: [11, 3, 8, 2, 14, 5, 4, 2] },
    { id: 'BN-H-04', name: 'Patiya Health Centre', district: 'Chattogram', upazila: 'Patiya', area: 'Patiya', verified: '2026-08-24', units: [3, 1, 1, 0, 5, 1, 2, 0] },
    { id: 'BN-H-05', name: 'Hathazari Upazila Health Complex', district: 'Chattogram', upazila: 'Hathazari', area: 'Hathazari', verified: '2026-08-22', units: [5, 2, 4, 1, 7, 0, 1, 1] }
  ],

  requests: [
    { id: 'BN-R-0142', requester: 'Sample Requester', group: 'A+', units: 2, needed: '2026-08-30', urgency: 'Critical', hospital: 'Kornofuli General Hospital', area: 'Boalkhali Sadar', contact: '01XXX-XXXXXX', posted: '2026-08-27' },
    { id: 'BN-R-0141', requester: 'Demo Requester', group: 'O−', units: 1, needed: '2026-09-02', urgency: 'Urgent', hospital: 'Chattogram City Blood Bank', area: 'Kotwali', contact: '01XXX-XXXXXX', posted: '2026-08-26' },
    { id: 'BN-R-0139', requester: 'Demo Requester', group: 'B+', units: 3, needed: '2026-09-10', urgency: 'Planned', hospital: 'Hathazari Upazila Health Complex', area: 'Hathazari Sadar', contact: '01XXX-XXXXXX', posted: '2026-08-24' }
  ]
};
