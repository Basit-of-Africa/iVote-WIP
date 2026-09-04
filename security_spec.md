# Security Specification - CivicWatch Election Monitoring

## Data Invariants
1. A Report must originate from an observer who exists in the `users` collection.
2. An Incident must reference a valid Report and a valid Polling Unit.
3. Users cannot change their own roles.
4. Only Admins can modify Polling Unit data or resolve Incidents.
5. Observers can only create reports for their assigned Polling Unit (for now, let's keep it flexible but authenticated).

## The Dirty Dozen Payloads (Rejection Targets)

1. **Identity Theft**: Observer attempts to submit a report with `observerId` of an Admin.
2. **Privilege Escalation**: User attempts to update their own role from `observer` to `admin`.
3. **Ghost Report**: Non-authenticated user attempts to submit a report.
4. **ID Poisoning**: Report with a 2MB string as `id`.
5. **State Skipping**: Observer attempts to mark an incident as `resolved`.
6. **Shadow Field**: Adding `isVerified: true` to a user profile during registration.
7. **Cross-unit Injection**: Observer assigned to Unit A submits report for Unit B (if enforcement is enabled).
8. **PII Leak**: Non-admin attempting to list all emails in the `users` collection.
9. **Invalid Type**: Submitting `totalRegisteredVoters` as a string instead of integer.
10. **Immortality Breach**: Attempting to change the `createdAt` timestamp of a report.
11. **Orphaned Incident**: Creating an incident without a valid `reportId`.
12. **Recursive Cost Attack**: Unauthenticated user attempting to list all reports without any filters.

## Test Strategy
The `firestore.rules` will be written to prevent these specifically using `isValid` helpers and `affectedKeys()`.
