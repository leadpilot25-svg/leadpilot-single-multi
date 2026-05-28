
export type LeadStatus = 'new' | 'contacted' | 'site_visit' | 'meeting' | 'closed' | 'inactive';

export interface Lead {
  id: string;
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  propertyType: string;
  budget?: string;
  location?: string;
  source: string;
  assignedTo: string;
  status: LeadStatus;
  notes?: string;
  followUpDate: string;
  followUpTime: string;
  createdBy: string;
  createdAt: any;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
}

export interface Activity {
  id: string;
  leadId: string;
  type: string;
  date: string;
  time: string;
  status: 'pending' | 'completed';
  createdBy: string;
  createdAt: any;
}
