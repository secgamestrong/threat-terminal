import generatedCards from "@/data/generated/cards.json";

export type Technique =
  | "urgency"
  | "authority-impersonation"
  | "credential-harvest"
  | "hyper-personalization"
  | "pretexting"
  | "fluent-prose"
  | "legitimate";

export type AuthResult = "pass" | "fail" | "none";

export interface ForensicSignal {
  label: string;
  observed: string;
  meaning: string;
}

export interface EmailCard {
  id: string;
  technique: Technique;
  isPhishing: boolean;
  from: string;
  replyTo?: string;
  sentAt: string;
  subject: string;
  body: string;
  url?: string;
  attachment?: string;
  auth: { spf: AuthResult; dkim: AuthResult; dmarc: AuthResult };
  explanation: string;
  signals: ForensicSignal[];
}

const seedCards: EmailCard[] = [
  {
    id: "tt-001",
    technique: "credential-harvest",
    isPhishing: true,
    from: "SharePoint Review <document@sharepoint-notice.example>",
    replyTo: "reviewdesk@inbox.example",
    sentAt: "08:42",
    subject: "A document was shared with you: Q4 access review",
    body: "Hello,\n\nA colleague shared a document that needs your review before the access review closes. Sign in to confirm you can view the file.\n\nOpen shared document\n\nIf you were not expecting this document, contact your IT team through your usual channel.",
    url: "https://login.microsoftonline.com.example/verify",
    auth: { spf: "pass", dkim: "fail", dmarc: "fail" },
    explanation: "The message imitates a familiar collaboration notice but routes sign-in to an unrelated lookalike domain.",
    signals: [
      { label: "URL", observed: "login.microsoftonline.com.example", meaning: "The registered host is microsoftonline.com.example, not microsoftonline.com." },
      { label: "Reply-To", observed: "reviewdesk@inbox.example", meaning: "Replies go to a different domain than the displayed sender." },
      { label: "Authentication", observed: "SPF pass · DKIM fail · DMARC fail", meaning: "A passing SPF record does not authenticate the visible brand or repair failed DKIM/DMARC alignment." },
    ],
  },
  {
    id: "tt-002",
    technique: "legitimate",
    isPhishing: false,
    from: "People Operations <people@northstar.example>",
    sentAt: "09:16",
    subject: "Benefits enrollment closes Friday",
    body: "Hi team,\n\nOpen enrollment closes Friday at 5 p.m. Pacific. You can review your current elections in the employee portal using the bookmark in your browser. No action is needed if you are keeping your existing selections.\n\nPeople Operations",
    auth: { spf: "pass", dkim: "pass", dmarc: "pass" },
    explanation: "The message has a familiar internal sender, aligned authentication, and asks people to use an existing trusted bookmark rather than a new sign-in link.",
    signals: [
      { label: "Authentication", observed: "SPF pass · DKIM pass · DMARC pass", meaning: "All three checks pass and align with the sender domain." },
      { label: "Call to action", observed: "Use the saved portal bookmark", meaning: "The email does not introduce an unexpected login URL." },
      { label: "Pressure", observed: "A clear deadline, no threat", meaning: "The deadline is specific and the message does not threaten account loss." },
    ],
  },
  {
    id: "tt-003",
    technique: "urgency",
    isPhishing: true,
    from: "Payroll Support <payroll@northstar-payroll.example>",
    replyTo: "case-441@outside-mail.example",
    sentAt: "11:58",
    subject: "Action required today: payroll deposit on hold",
    body: "Your upcoming payroll deposit is on hold because your tax profile could not be verified. Update the profile in the next 30 minutes to prevent a delay.\n\nUse the secure update form below. If you have already completed this, disregard this message.",
    url: "https://northstar.example.payroll-check.example/update",
    auth: { spf: "pass", dkim: "pass", dmarc: "fail" },
    explanation: "The sender uses a lookalike domain and an artificial deadline to push the recipient into a sensitive update flow.",
    signals: [
      { label: "URL", observed: "northstar.example.payroll-check.example", meaning: "The real registrable domain is payroll-check.example." },
      { label: "Reply-To", observed: "case-441@outside-mail.example", meaning: "Replies leave the apparent payroll domain." },
      { label: "Urgency", observed: "30-minute deadline", meaning: "A short deadline is used to discourage independent verification." },
    ],
  },
  {
    id: "tt-004",
    technique: "legitimate",
    isPhishing: false,
    from: "Build Platform <builds@engineering.example>",
    sentAt: "13:07",
    subject: "Staging deploy completed: payments-api",
    body: "The staging deployment for payments-api completed at 13:05 UTC.\n\nCommit: 6f8c21a\nEnvironment: staging\nPipeline: release-staging\n\nReview the deployment in the CI dashboard using your normal bookmark.",
    attachment: "deployment-summary.txt",
    auth: { spf: "pass", dkim: "pass", dmarc: "pass" },
    explanation: "Expected operational context, no credential request, aligned sender authentication, and a normal navigation path.",
    signals: [
      { label: "Context", observed: "Specific service and deployment metadata", meaning: "The details are consistent with an engineering notification." },
      { label: "Attachment", observed: "Plain-text deployment summary", meaning: "The attachment type is expected for the stated purpose." },
      { label: "Navigation", observed: "Use your normal dashboard bookmark", meaning: "The message avoids a new authentication destination." },
    ],
  },
  {
    id: "tt-005",
    technique: "authority-impersonation",
    isPhishing: true,
    from: "Security Operations <security-director@northstar.example>",
    replyTo: "response-team@external-inbox.example",
    sentAt: "07:31",
    subject: "Keep this incident confidential — verify your account",
    body: "We are investigating an access incident. To preserve evidence, do not contact the help desk. Confirm your credentials in the response portal and keep this request within this thread.\n\nI will follow up after containment.",
    url: "https://northstar-response.example/identity",
    auth: { spf: "pass", dkim: "fail", dmarc: "fail" },
    explanation: "The message impersonates authority, isolates the recipient, and asks for credentials through an unrelated portal.",
    signals: [
      { label: "Isolation", observed: "Do not contact the help desk", meaning: "It discourages verification through a known channel." },
      { label: "Reply-To", observed: "response-team@external-inbox.example", meaning: "The reply address is outside the claimed organization." },
      { label: "Request", observed: "Confirm credentials in a new portal", meaning: "A security incident is used as a pretext for credential collection." },
    ],
  },
  {
    id: "tt-006",
    technique: "legitimate",
    isPhishing: false,
    from: "Facilities <facilities@northstar.example>",
    sentAt: "14:23",
    subject: "South entrance badge readers: Thursday maintenance",
    body: "Facilities will test the south entrance badge readers Thursday from 6:30–7:00 a.m. The north entrance will remain available. No action is needed.\n\nFacilities Operations",
    auth: { spf: "pass", dkim: "pass", dmarc: "pass" },
    explanation: "A routine notice with a bounded operational impact, no sensitive request, and aligned domain authentication.",
    signals: [
      { label: "Action", observed: "No action is needed", meaning: "The message does not ask for credentials, payment, or a file download." },
      { label: "Sender", observed: "facilities@northstar.example", meaning: "The visible address matches the established internal domain." },
      { label: "Impact", observed: "Specific place and maintenance window", meaning: "The notice gives practical details without emotional pressure." },
    ],
  },
  {
    id: "tt-007",
    technique: "hyper-personalization",
    isPhishing: true,
    from: "Conference Team <speaker-care@event-coordination.example>",
    replyTo: "speaker-care@event-coordination.example",
    sentAt: "10:02",
    subject: "Your panel recording and the revised speaker order",
    body: "Hi Morgan,\n\nThanks again for the cloud identity panel. We moved your segment to 2:40 p.m. and attached the updated speaker order. The recording is ready in the review room; sign in with your work account so we can release the high-resolution file.\n\nBest,\nConference Team",
    url: "https://event-coordination.example/review/morgan",
    attachment: "speaker-order.pdf.html",
    auth: { spf: "pass", dkim: "pass", dmarc: "pass" },
    explanation: "Personal detail can make a message feel credible, but the unusual file extension and sign-in request still need independent verification.",
    signals: [
      { label: "Attachment", observed: "speaker-order.pdf.html", meaning: "The final extension is HTML, not PDF." },
      { label: "Authentication", observed: "SPF/DKIM/DMARC pass", meaning: "Authentication confirms control of a domain, not that the sender is an expected conference partner." },
      { label: "Request", observed: "Work-account sign-in to release a recording", meaning: "A plausible personalized pretext is paired with credential collection." },
    ],
  },
  {
    id: "tt-008",
    technique: "legitimate",
    isPhishing: false,
    from: "Design System <design-system@northstar.example>",
    sentAt: "15:45",
    subject: "New component release: form-field 3.8.0",
    body: "Version 3.8.0 of form-field is available in the internal package registry. The release includes an accessible error state and updated tokens.\n\nRelease notes are in the engineering handbook. Contact the Design System team in the usual channel with questions.",
    auth: { spf: "pass", dkim: "pass", dmarc: "pass" },
    explanation: "The message points to a known internal workflow and asks for no sensitive action.",
    signals: [
      { label: "Destination", observed: "Engineering handbook and package registry", meaning: "These are existing internal systems rather than new sign-in links." },
      { label: "Request", observed: "No password, payment, or MFA action", meaning: "The email does not request a high-impact action." },
      { label: "Auth", observed: "SPF/DKIM/DMARC pass", meaning: "Sender-domain checks align." },
    ],
  },
  {
    id: "tt-009",
    technique: "pretexting",
    isPhishing: true,
    from: "Vendor Billing <billing@ledger-reconcile.example>",
    replyTo: "billing@ledger-reconcile.example",
    sentAt: "16:18",
    subject: "Updated remittance instructions for invoice 2841",
    body: "Our finance system is being migrated, so the remittance details for invoice 2841 have changed. Please use the attached instructions for this payment and reply with the confirmation number when complete.\n\nThank you,\nVendor Billing",
    attachment: "remittance-update.xlsx",
    auth: { spf: "fail", dkim: "none", dmarc: "fail" },
    explanation: "A vendor-system migration is used to legitimize a payment-detail change. Verify through a previously known contact route.",
    signals: [
      { label: "Payment", observed: "New remittance instructions", meaning: "Bank-detail changes should be confirmed out of band." },
      { label: "Authentication", observed: "SPF fail · DKIM none · DMARC fail", meaning: "The sending domain did not pass the available authentication checks." },
      { label: "Process", observed: "Confirm by replying to this email", meaning: "The message controls the verification channel." },
    ],
  },
  {
    id: "tt-010",
    technique: "legitimate",
    isPhishing: false,
    from: "Library Services <library@northstar.example>",
    sentAt: "08:05",
    subject: "Your reserved book is ready for pickup",
    body: "Your reservation is ready at the main desk. Please bring your staff badge. The hold expires in seven days.\n\nYou can check library hours on the intranet or call the main desk using the number in the directory.",
    auth: { spf: "pass", dkim: "pass", dmarc: "pass" },
    explanation: "A low-impact service notice with a normal pickup process and no external link or sensitive request.",
    signals: [
      { label: "Request", observed: "Bring a staff badge to the desk", meaning: "This is consistent with the stated service." },
      { label: "Link", observed: "No new link", meaning: "The email does not ask the recipient to authenticate through an embedded URL." },
      { label: "Deadline", observed: "Seven-day hold", meaning: "The time limit is proportionate to a reservation and not used to threaten loss." },
    ],
  },
  {
    id: "tt-011",
    technique: "fluent-prose",
    isPhishing: true,
    from: "Research Library <library-updates@northstar.example>",
    replyTo: "research-library@outside-mail.example",
    sentAt: "12:11",
    subject: "A brief note about your access renewal",
    body: "Hello,\n\nAs part of our quarterly access review, we are confirming that current research subscriptions remain available to the right teams. Please review the summary and confirm your account when convenient today.\n\nWe appreciate your help keeping the collection accurate.\n\nResearch Library Services",
    url: "https://northstar.example.access-review.example/confirm",
    auth: { spf: "pass", dkim: "fail", dmarc: "fail" },
    explanation: "Polished language is not a trust signal. The reply path and registrable domain contradict the claimed service.",
    signals: [
      { label: "URL", observed: "northstar.example.access-review.example", meaning: "The registrable domain is access-review.example." },
      { label: "Reply-To", observed: "research-library@outside-mail.example", meaning: "The reply destination is unrelated to the claimed internal library." },
      { label: "Language", observed: "Professional and calm", meaning: "Fluent prose can be produced by attackers and is not enough to establish legitimacy." },
    ],
  },
  {
    id: "tt-012",
    technique: "legitimate",
    isPhishing: false,
    from: "Security Awareness <awareness@northstar.example>",
    sentAt: "09:30",
    subject: "Monthly security briefing: reporting suspicious mail",
    body: "This month's briefing explains how to report a suspicious message and what happens after you submit it.\n\nOpen the security portal from the company intranet. You can also use the Report Message control in your mail client.\n\nSecurity Awareness",
    auth: { spf: "pass", dkim: "pass", dmarc: "pass" },
    explanation: "The training notice uses the established portal route and gives a second known reporting method.",
    signals: [
      { label: "Navigation", observed: "Open the portal from the intranet", meaning: "The recipient is not asked to follow a fresh external URL." },
      { label: "Alternative", observed: "Report Message control", meaning: "A known mail-client action is provided as another route." },
      { label: "Auth", observed: "SPF/DKIM/DMARC pass", meaning: "Sender-domain authentication aligns." },
    ],
  },
];

export const cards: EmailCard[] = [...seedCards, ...(generatedCards as EmailCard[])];

export const phishingTechniqueLabels: Record<Technique, string> = {
  urgency: "Urgency",
  "authority-impersonation": "Authority impersonation",
  "credential-harvest": "Credential harvest",
  "hyper-personalization": "Hyper-personalization",
  pretexting: "Pretexting",
  "fluent-prose": "Fluent prose",
  legitimate: "Legitimate message",
};

