# AI-Powered Web Threat Detection & Digital Trust Intelligence

**Domains:** Artificial Intelligence · Cybersecurity · Web3

**Build Duration:** 48 Hours

## 1. Background

The internet has become an essential part of everyday life, powering online banking, education, recruitment, e-commerce, digital payments, business communication, and countless other services. However, this growing dependence has also made individuals and organisations increasingly vulnerable to digital threats.

Phishing websites, fraudulent payment links, fake recruitment portals, impersonated organisations, malicious redirects, deceptive advertisements, and credential-harvesting attacks are becoming increasingly sophisticated.

A fraudulent website can closely resemble a legitimate banking portal, university website, government service, or corporate platform. Users may unknowingly share their passwords, financial information, personal details, or authentication credentials.

Beyond conventional phishing, the internet's underlying trust infrastructure also faces security challenges. Digital certificates and Certificate Authorities play a critical role in establishing secure HTTPS connections and verifying website identities. Weak cryptographic implementations, compromised certificate authorities, and improperly managed certificate trust chains can undermine this trust.

The recent eMudhra TLS certificate incident demonstrated how weaknesses in Certificate Authority key generation could potentially allow fraudulent certificates to be created for website impersonation. It highlighted the importance of certificate transparency, cryptographic validation, and continuous monitoring of the web's trust infrastructure.

At the application level, insecure configurations, exposed services, outdated software, and other web security weaknesses can further increase the risk of exploitation.

Existing security tools often address these problems independently. There is an opportunity to build an accessible platform that brings together intelligent threat detection, website security analysis, certificate validation, and collaborative threat intelligence.

## 2. The Challenge

**How might we build an intelligent digital security platform that helps individuals and organisations identify phishing websites, fraudulent links, online scams, website impersonation, and suspicious digital activity before they become victims?**

Teams must develop a solution combining Artificial Intelligence, Cybersecurity, and Web3 to investigate suspicious digital content, analyse website security, identify potential threats, and provide evidence-based security assessments.

The platform should allow anyone to submit a suspicious URL, website, domain, email, or message and receive an understandable assessment of its potential risks.

Rather than simply labelling websites as safe or malicious, the system should identify suspicious indicators, explain its findings, validate available security information, and help users make informed decisions.

## 3. Real-World Problem Scenarios

### A. Phishing Websites and Suspicious Links

Users frequently encounter malicious links disguised as legitimate websites.

Examples include:

- Fake banking and payment gateways.

- University admission and examination portals.

- Government service and tax-payment websites.

- Fake parcel delivery and payment confirmation links.

- Fraudulent job application and internship portals.

- Impersonated social media login pages.

- Fake customer support and account recovery websites.

- Malicious shortened URLs and redirect chains.

The platform should investigate suspicious links and identify indicators such as:

- Domain spoofing and typosquatting.

- Homograph attacks and deceptive character substitutions.

- Suspicious URL structures and embedded redirect parameters.

- Domains associated with known phishing campaigns.

- Mismatches between the claimed organisation and actual website identity.

- Unexpected redirects to unrelated domains.

- Previously reported malicious destinations.

**Expected outcome:** Help users understand whether a link is potentially dangerous before opening it or sharing sensitive information.

### B. Website Certificates and Digital Trust Vulnerabilities

HTTPS is commonly perceived as an indication that a website is trustworthy. However, HTTPS primarily provides an encrypted connection and certificate-based authentication. It does not guarantee that a website is legitimate or free from fraud.

Weaknesses in TLS certificates, certificate authorities, cryptographic implementations, and trust chains can introduce significant security risks.

The platform should investigate:

- Expired or invalid TLS certificates.

- Hostname and certificate identity mismatches.

- Untrusted or revoked certificate authorities.

- Suspicious or unexpected certificate issuances.

- Weak cryptographic algorithms and inadequate key sizes.

- Incorrect certificate chain configurations.

- Certificate transparency anomalies.

- Known compromised certificate authorities and intermediate certificates.

The system may also monitor certificate transparency information to identify unexpected certificates issued for particular domains.

It should distinguish between ordinary certificate configuration problems and security incidents involving compromised cryptographic trust.

For example, in an eMudhra-like scenario, the platform should be capable of identifying certificates linked to known compromised or distrusted certificate authorities using trusted security intelligence and certificate chain information.

It must not claim to independently detect the internal key-generation weakness of a Certificate Authority merely from a website URL.

### C. Online Scams and Social Engineering

Many fraudulent activities do not require a technically sophisticated website. Attackers often exploit human behaviour through deceptive messages and communication.

Examples include:

- Fake job and internship offers.

- Investment and cryptocurrency scams.

- Fake giveaways and prize notifications.

- Fraudulent refund and cashback messages.

- Impersonation of banks, universities, and companies.

- Fake customer support communications.

- Requests for OTPs, passwords, or payment credentials.

- Fraudulent KYC and account verification notifications.

- Fake technical support and remote-access scams.

The platform should accept suspicious messages, email content, and communication text for analysis.

It should identify suspicious language, impersonation indicators, unusual payment requests, misleading links, and attempts to obtain sensitive information.

### D. Website Security and Vulnerability Assessment

Apart from phishing, websites themselves can expose users and organisations to security risks through insecure configurations and common vulnerabilities.

The platform may perform safe, non-intrusive website security checks, including:

- Missing or incorrectly configured security headers.

- Insecure HTTP configurations.

- Weak TLS configurations.

- Exposed or publicly accessible sensitive endpoints where detectable through passive inspection.

- Suspicious redirects and mixed-content issues.

- Known software and dependency vulnerabilities where reliable version information is publicly available.

The platform should explain the potential impact of each finding and provide recommendations.

It should not attempt to exploit vulnerabilities or perform intrusive scanning against websites without explicit authorisation.

## 4. Core Functional Requirements

### Module 1: Intelligent URL and Website Analysis

Users should be able to submit any suspicious URL or domain for investigation.

The platform should:

- Normalise and inspect submitted URLs.

- Analyse domain structure and suspicious naming patterns.

- Identify potential phishing and impersonation indicators.

- Examine redirect chains and destination domains.

- Check domain reputation against available threat intelligence sources.

- Identify suspicious DNS and domain characteristics where available.

- Associate detected indicators with known threat reports.

The analysis should produce:

- Website and domain information.

- Identified suspicious indicators.

- Known threat intelligence matches.

- Redirect analysis.

- Risk classification.

- Supporting evidence.

- Recommended precautions.

### Module 2: TLS Certificate and Web Trust Analysis

When a URL is submitted, the platform should inspect its HTTPS configuration and certificate information.

Possible checks include:

- Certificate validity and expiration.

- Domain identity and Subject Alternative Name verification.

- Issuing Certificate Authority and certificate chain.

- Certificate revocation and known distrust information.

- Public key strength and signature algorithms.

- Certificate Transparency records.

- Known compromised CA and intermediate certificate indicators.

The platform should generate a certificate security report that explains whether the website's TLS configuration appears valid, suspicious, or potentially compromised based on available evidence.

A valid TLS certificate must never be treated as proof that the website itself is safe.

### Module 3: AI-Powered Scam and Message Analysis

Users should be able to paste suspicious messages, emails, notifications, or other digital communications.

The AI analysis system should:

- Identify common social engineering patterns.

- Detect urgency-based manipulation and suspicious payment requests.

- Recognise impersonation attempts.

- Extract URLs, email addresses, phone numbers, and other relevant indicators.

- Correlate extracted indicators with available threat intelligence.

- Explain the potential risks in understandable language.

- Recommend appropriate safety measures.

The AI should distinguish between suspicious language and verified evidence of fraud.

A message should not be labelled fraudulent solely because it contains urgent or persuasive language.

### Module 4: Intelligent Threat Correlation

Individual suspicious links or messages may be part of larger fraud campaigns.

The platform should attempt to correlate related indicators across submitted reports.

For example:

Multiple users report different messages claiming to originate from the same bank. Although the URLs differ, they redirect to domains associated with the same infrastructure or reuse suspicious payment destinations.

The system should be able to:

- Identify repeated domains and infrastructure.

- Detect similarities between reported phishing messages.

- Identify recurring impersonation patterns.

- Correlate previously reported URLs and indicators.

- Build relationships between potentially connected incidents.

AI can assist in summarising these relationships, while deterministic matching and supporting evidence should establish the actual connections.

### Module 5: Website Security Assessment

Provide a basic security assessment for publicly accessible websites.

The platform should inspect publicly available security information and report configuration weaknesses without attempting exploitation.

Each finding should include:

- Identified security issue.

- Technical evidence.

- Potential impact.

- Severity classification.

- Recommended remediation.

- Relevant limitations.

Any active testing must be restricted to explicitly authorised targets.

### Module 6: Decentralized Threat Intelligence

Web3 should provide a mechanism for transparent, tamper-evident sharing and verification of security intelligence.

The platform should allow users to submit relevant threat reports containing:

- Suspicious URL or domain indicators.

- Reported phishing campaigns.

- Security incident summaries.

- Cryptographic fingerprints of reports.

- Supporting evidence references.

Blockchain integration should enable:

- Recording cryptographic commitments to security reports.

- Maintaining a verifiable reporting history.

- Independently checking report integrity.

- Tracking report revisions, disputes, and validation status.

- Establishing transparent provenance for submitted threat intelligence.

Raw URLs, personal information, email content, passwords, and sensitive user data must remain off-chain.

A blockchain record establishes the integrity and history of a report, not the truth of the report itself.

## 5. Expected User Experience

The platform should provide a simple workflow that anyone can understand.

#### Step 1: Submit

A user pastes a suspicious link, submits a domain, or provides a suspicious email or message.

#### Step 2: Investigate

The platform collects available domain information, certificate details, threat intelligence, and relevant technical indicators.

#### Step 3: Analyse

Cybersecurity checks identify suspicious patterns, while AI correlates the findings and generates an understandable explanation.

#### Step 4: Assess Risk

The platform provides a structured report describing the identified threats, their supporting evidence, and recommended precautions.

#### Step 5: Report and Verify

Users can submit relevant incidents to the threat intelligence repository, where cryptographic commitments are recorded on-chain for independent verification.

## 6. Risk Classification

The system must use a consistent classification mechanism.

| Classification | Description |
| --- | --- |
| Low Risk | No significant malicious indicators identified within the available checks |
| Suspicious | One or more indicators require further investigation |
| High Risk | Multiple significant indicators suggest a substantial security threat |
| Confirmed Malicious | Supported by authoritative threat intelligence or sufficiently validated evidence |
| Inconclusive | Insufficient data or unavailable verification sources |

Each assessment should include:

- Overall risk classification.

- Identified threat indicators.

- Supporting technical evidence.

- Source of each important finding.

- Analysis timestamp.

- Confidence or evidence coverage.

- Recommended actions.

- Limitations and unavailable checks.

The system must not treat the absence of known threats as proof that a website is safe.

## 7. Mandatory 48-Hour MVP Requirements

Teams should build a focused, functional prototype with an end-to-end security investigation workflow.

| Component | Minimum Requirement |
| --- | --- |
| URL Analysis | Accept and investigate submitted URLs or domains |
| Phishing Detection | Identify suspicious URLs and phishing indicators |
| TLS Analysis | Inspect HTTPS certificates and identify relevant trust issues |
| AI Integration | Generate evidence-grounded explanations of security findings |
| Scam Detection | Analyse pasted messages or email content |
| Risk Assessment | Produce structured and explainable risk classifications |
| Threat Intelligence | Integrate at least one external intelligence source or documented dataset |
| Web3 Integration | Implement an on-chain threat-report registry or equivalent |
| Verification | Independently verify a registered report's integrity |
| Dashboard | Provide a functional investigation interface |
| Testing | Demonstrate at least three suspicious and three benign test cases |

Teams are not required to implement every advanced feature. They should prioritise a working URL investigation pipeline with meaningful security checks and reliable output.

## 8. Suggested Technology Stack

Teams may use any suitable technology.

| Domain | Possible Technologies |
| --- | --- |
| AI | LLMs, NLP, machine learning, anomaly detection, RAG |
| URL Intelligence | Google Safe Browsing, URLhaus, PhishTank, OpenPhish, VirusTotal |
| Web Security | Python SSL libraries, OpenSSL, DNS analysis, HTTP security-header inspection |
| Certificate Intelligence | Certificate Transparency logs, crt.sh, public CA trust information |
| Blockchain | Solidity, EVM-compatible networks, smart contracts |
| Backend | Python, FastAPI, Node.js |
| Frontend | React, Next.js, TypeScript |
| Database | PostgreSQL, MongoDB, Redis |
| Infrastructure | Docker, cloud hosting |

External APIs, open-source tools, existing models, and public security datasets are permitted.

Teams do not need to train AI models from scratch.

## 9. Security and Privacy Requirements

The security platform must not become a security risk itself.

#### Safe URL Inspection

- Protect against SSRF and internal network access.

- Validate redirects and destination IP addresses.

- Avoid executing scripts or downloading potentially malicious files.

- Use isolated environments for website inspection.

- Apply request limits and timeouts.

#### AI Security

- Treat webpage content and submitted messages as untrusted inputs.

- Prevent prompt injection from influencing security decisions.

- Require evidence for important findings.

- Do not expose sensitive user information to external AI services unnecessarily.

#### Privacy

- Never request passwords, OTPs, private keys, or seed phrases.

- Avoid unnecessary collection of personal information.

- Do not store sensitive content on public blockchains.

- Protect API credentials and user-submitted reports.

#### Operational Safety

- Do not execute malware or exploit vulnerable websites.

- Do not perform intrusive security testing without authorisation.

- Do not claim a website is secure simply because automated checks pass.

## 10. Expected Deliverables

Each team must provide:

- **Working Prototype:** A functioning web application with URL or domain investigation capabilities.

- **Public GitHub Repository:** Complete source code and setup instructions.

- **AI Demonstration:** An example of intelligent scam analysis with evidence-based explanations.

- **Cybersecurity Demonstration:** A phishing detection or suspicious website investigation, including TLS certificate analysis.

- **Web3 Demonstration:** A deployed smart contract on a testnet or reproducible local blockchain setup.

- **Verification Evidence:** Contract address and transaction reference or equivalent reproducible verification.

- **Technical Documentation:** Architecture, analysis pipeline, threat intelligence sources, and security methodology.

- **Testing Report:** Documented legitimate and suspicious test cases with observed results.

- **Live Demonstration:** An end-to-end example showing submission, investigation, risk assessment, and threat reporting.

## 11. Evaluation Criteria

| Category | Weight | Evaluation Focus |
| --- | --- | --- |
| Cybersecurity & Threat Detection | 30% | Phishing detection, certificate analysis, evidence quality, and false-positive handling |
| AI Implementation | 20% | Intelligent investigation, contextual analysis, and explainability |
| Web3 Integration | 20% | Meaningful threat reporting, integrity, and independent verification |
| Technical Implementation | 20% | Working architecture, reliability, and integration quality |
| Innovation & User Experience | 10% | Practical relevance, usability, and originality |
| Total | 100% |  |

Judges should evaluate demonstrated functionality rather than the number of technologies or APIs integrated.

## 12. Optional Advanced Extensions

Teams can explore additional capabilities such as:

- A browser extension that checks links before navigation.

- Real-time phishing protection.

- QR code scam detection.

- Screenshot-based website impersonation detection.

- Email security analysis.

- Domain monitoring and alerts for suspicious certificate issuance.

- Detection of lookalike and homoglyph domains.

- Monitoring known compromised CA certificates.

- Automated security header and TLS configuration audits.

- Threat intelligence sharing APIs.

- Community-based scam reporting and validation.

- An organisation-level website security monitoring dashboard.

These extensions are optional and should not replace the mandatory MVP.

## 13. Scope Boundaries

The challenge is designed to be achievable within 48 hours.

Teams are not expected to:

- Build a complete antivirus solution.

- Train foundation models from scratch.

- Detect every possible type of cyberattack.

- Reproduce or exploit real-world vulnerabilities.

- Build a complete commercial threat intelligence database.

- Support every Certificate Authority or blockchain network.

- Perform unauthorised vulnerability scanning.

- Guarantee that all websites are safe or malicious.

A focused, reliable prototype that successfully identifies real phishing patterns, inspects TLS certificate trust, explains evidence, and verifies threat reports is the intended outcome.

## 14. Final Objective

Build an accessible, intelligent digital security platform that helps individuals and organisations identify potentially malicious websites, avoid phishing attacks, recognise online scams, and understand the security risks associated with the websites they interact with.

The solution should demonstrate how Artificial Intelligence can investigate and correlate suspicious activity, Cybersecurity can identify and validate technical threats, and Web3 can establish a transparent and verifiable mechanism for sharing threat intelligence.

**The objective is to make the internet a safer place by helping people identify digital deception before they become its victims.**
