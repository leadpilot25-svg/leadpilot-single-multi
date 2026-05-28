# Security Specification - LeadPilot

## Data Invariants
1. A lead must always be assigned to a user (admin or agent).
2. Users can only read/write leads assigned to them, unless they are an admin.
3. Activities must be linked to a valid lead.
4. Admins have full access to all collections.
5. Agents can only see their own assigned leads and activities they created.

## The "Dirty Dozen" Payloads (Denial Tests)
1. Agent trying to read a lead assigned to another agent.
2. Agent trying to update `assignedTo` field of a lead (Admin only).
3. Public user trying to read all leads (Only public form submission is allowed).
4. Authenticated user trying to set their own role to 'admin'.
5. Creating a lead with a 2MB note (Resource poisoning).
6. Updating a lead's `status` to a non-enum value.
7. Deleting a lead (Admins only/Limited).
8. Creating an activity for a lead not assigned to the agent.
9. Reading user profiles of other users (Private PII isolation).
10. Spoofing `createdAt` using client time instead of server time.
11. Bypassing `email_verified` check (if enabled).
12. Updating lead data without the `isValidLead` helper.

## Test Runner (Draft)
A `firestore.rules.test.ts` would verify these constraints using the Firebase Rules Emulator.
